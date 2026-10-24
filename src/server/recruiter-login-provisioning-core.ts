import {requireAdmin,ServiceError,type Actor} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';

type ApprovedAccount={id:string;email:string;role:string;active:number;user_id:string|null;data_json:string};
export type AuthIdentity={id:string;email?:string;email_confirmed_at?:string|null};
export type AuthAdmin={
 listUsers(input:{page:number;perPage:number}):Promise<{data:{users:AuthIdentity[]}|null;error:unknown|null}>;
 createUser(input:{email:string;password:string;email_confirm:true;user_metadata:Record<string,string>}):Promise<{data:{user:AuthIdentity|null}|null;error:unknown|null}>;
 updateUserById(id:string,input:{password:string;user_metadata:Record<string,string>}):Promise<{data:{user:AuthIdentity|null}|null;error:unknown|null}>;
};
export type ProvisionDependencies={admin:AuthAdmin;now?:()=>number};

async function findIdentity(admin:AuthAdmin,email:string):Promise<AuthIdentity|null>{
 const matches:AuthIdentity[]=[];
 for(let page=1;page<=100;page++){
  const result=await admin.listUsers({page,perPage:100});
  if(result.error||!result.data)throw new ServiceError('Supabase Auth could not be checked. Retry the login setup.',503,'auth_unavailable');
  matches.push(...result.data.users.filter(user=>user.email?.trim().toLowerCase()===email));
  if(result.data.users.length<100)break;
 }
 if(matches.length>1)throw new ServiceError('More than one Supabase login uses this email. Owner review is required.',409,'identity_conflict');
 return matches[0]??null;
}

export async function provisionRecruiterLoginCore(db:D1Database,actor:Actor,input:unknown,_origin:string,config:ProvisionDependencies){
 requireAdmin(actor);
 const p=zodInput(input);
 const account=await db.prepare('SELECT id,email,role,active,user_id,data_json FROM recruiters WHERE id=?').bind(p.recruiterId).first<ApprovedAccount>();
 if(!account||account.role!=='recruiter'||account.active!==1)throw new ServiceError('Choose an active recruiter account before creating its login.',409,'account_unavailable');
 const email=account.email.trim().toLowerCase();
 const profile=JSON.parse(account.data_json) as {fullName?:string;alias?:string};
 const temporaryPassword=temporaryPasswordForName(profile.fullName);
 const existingBindings=(await db.prepare('SELECT recruiter_id,auth_user_id,verified_email FROM recruiter_login_bindings WHERE recruiter_id=? OR lower(verified_email)=?').bind(account.id,email).all<{recruiter_id:string;auth_user_id:string;verified_email:string}>()).results;
 if(existingBindings.some(binding=>binding.recruiter_id!==account.id||binding.verified_email.toLowerCase()!==email))throw new ServiceError('This email or login identity is already linked to another recruiter.',409,'identity_conflict');
 let identity=existingBindings[0]?await findIdentityById(config.admin,existingBindings[0].auth_user_id):account.user_id?await findIdentityById(config.admin,account.user_id):await findIdentity(config.admin,email);
 let created=false;
 if(!identity){
  if(account.user_id||existingBindings.length)throw new ServiceError('The linked Supabase login could not be found. Owner review is required.',409,'identity_conflict');
  const result=await config.admin.createUser({email,password:temporaryPassword,email_confirm:true,user_metadata:{full_name:profile.fullName??'',recruiter_alias:profile.alias??''}});
  identity=result.data?.user??null;
  if(result.error||!identity){
   // A concurrent setup request may have created the same email moments ago.
   identity=await findIdentity(config.admin,email);
   if(!identity)throw new ServiceError('Supabase could not create this login. Check the configured server key and retry.',503,'auth_create_failed');
  }else created=true;
 }
 if(identity.email?.trim().toLowerCase()!==email)throw new ServiceError('Supabase returned a different email for this login. No account was linked.',409,'identity_conflict');
 if(!identity.email_confirmed_at)throw new ServiceError('This Supabase user has not verified the email yet. Have them verify it first, then resend the setup link.',409,'email_unverified');
 if(account.user_id&&account.user_id!==identity.id)throw new ServiceError('This recruiter profile is already linked to a different login. Owner review is required.',409,'identity_conflict');
 const otherLink=await db.prepare('SELECT recruiter_id FROM recruiter_login_bindings WHERE auth_user_id=? AND recruiter_id<>?').bind(identity.id,account.id).first<{recruiter_id:string}>();
 if(otherLink)throw new ServiceError('This Supabase login is already assigned to another recruiter.',409,'identity_conflict');
 if(!created){
  const result=await config.admin.updateUserById(identity.id,{password:temporaryPassword,user_metadata:{full_name:profile.fullName??'',recruiter_alias:profile.alias??''}});
  if(result.error||!result.data?.user)throw new ServiceError('Supabase could not set the recruiter’s temporary password. Check the server key and retry.',503,'auth_password_update_failed');
  identity=result.data.user;
 }
 const revision=await currentRevision(db),now=(config.now??Date.now)();
 try{
  await guardedBatch(db,revision,[
   db.prepare('INSERT INTO recruiter_login_bindings(recruiter_id,auth_user_id,verified_email,must_change,updated_at) VALUES(?,?,?,1,?) ON CONFLICT(recruiter_id) DO UPDATE SET auth_user_id=excluded.auth_user_id,verified_email=excluded.verified_email,must_change=1,updated_at=excluded.updated_at').bind(account.id,identity.id,email,now),
   db.prepare('UPDATE recruiters SET user_id=? WHERE id=? AND lower(email)=? AND active=1 AND (user_id IS NULL OR user_id=?)').bind(identity.id,account.id,email,identity.id),
   db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'recruiter_login_linked',?,?)").bind(`recruiter-login:${account.id}:${identity.id}:${crypto.randomUUID()}`,actor.id,now,JSON.stringify({email,authIdentityCreated:created,temporaryPasswordReset:true})),
  ]);
 }catch(error){
  const raced=await db.prepare('SELECT recruiter_id,auth_user_id,verified_email FROM recruiter_login_bindings WHERE recruiter_id=? OR lower(verified_email)=?').bind(account.id,email).first<{recruiter_id:string;auth_user_id:string;verified_email:string}>();
  if(!raced||raced.recruiter_id!==account.id||raced.auth_user_id!==identity.id||raced.verified_email.toLowerCase()!==email)throw error;
 }
 return {linked:true,temporaryPassword,message:`Login is ready for ${email}. Temporary password: ${temporaryPassword}. The recruiter must choose a new password on first sign-in.`};
}

function temporaryPasswordForName(fullName:string|undefined){
 const parts=(fullName??'').trim().replace(/đ/gi,'dj').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').split(/\s+/).filter(Boolean);
 const first=parts[0]?.toLowerCase().replace(/[^a-z0-9]/g,'')??'',last=parts.at(-1)?.toLowerCase().replace(/[^a-z0-9]/g,'')??'';
 if(!first||!last||parts.length<2)throw new ServiceError('Enter the recruiter’s real first and last name to set the temporary password as firstname.lastname2026.',400,'name_required');
 const password=`${first}.${last}2026`;
 if(password.length>72)throw new ServiceError('The recruiter’s name is too long for the temporary password format. Shorten the name before creating the login.',400,'password_name_too_long');
 return password;
}

async function findIdentityById(admin:AuthAdmin,id:string):Promise<AuthIdentity|null>{
 for(let page=1;page<=100;page++){
  const result=await admin.listUsers({page,perPage:100});
  if(result.error||!result.data)throw new ServiceError('Supabase Auth could not be checked. Retry the login setup.',503,'auth_unavailable');
  const match=result.data.users.find(user=>user.id===id);if(match)return match;
  if(result.data.users.length<100)break;
 }
 return null;
}

function zodInput(input:unknown){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ServiceError('Select a recruiter account.',400,'invalid_input');
 const recruiterId=(input as {recruiterId?:unknown}).recruiterId;
 if(typeof recruiterId!=='string'||recruiterId.length<1||recruiterId.length>160)throw new ServiceError('Select a recruiter account.',400,'invalid_input');
 return {recruiterId};
}

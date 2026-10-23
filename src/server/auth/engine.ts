import type {SupabaseClient,Session,User} from '@supabase/supabase-js';
import {ServiceError,type Actor} from '../access.ts';
import {opaqueToken,tokenHash,encryptTokens,decryptTokens,SESSION_MS,sessionValid,validatePassword} from './session-crypto.ts';
export type LoginUser={userId:string;recruiterId:string;email:string;displayName:string;fullName:string|null;mustChangePassword:boolean;expiresAt:number;actor:Actor};
type Binding={id:string;email:string;role:Actor['role'];active:number;data_json:string;auth_user_id:string;must_change:number};
type StoredSession={token_hash:string;recruiter_id:string;auth_user_id:string;email:string;encrypted_tokens:string;purpose:string;created_at:number;expires_at:number};
export class AuthEngine {
 private db:D1Database;private makeClient:()=>SupabaseClient;private secret:string;private now:()=>number;
 constructor(db:D1Database,makeClient:()=>SupabaseClient,secret:string,now:()=>number=Date.now){this.db=db;this.makeClient=makeClient;this.secret=secret;this.now=now;}
 async binding(authUser:Pick<User,'id'|'email'|'email_confirmed_at'>):Promise<Binding>{
  if(!authUser.email||!authUser.email_confirmed_at)throw new ServiceError('Email or password is incorrect.',401,'invalid_credentials');
  const normalized=authUser.email.trim().toLowerCase();
  const rows=(await this.db.prepare('SELECT r.id,r.email,r.role,r.active,r.data_json,b.auth_user_id,b.must_change FROM recruiters r JOIN recruiter_login_bindings b ON b.recruiter_id=r.id WHERE lower(r.email)=? AND lower(b.verified_email)=? AND b.auth_user_id=? AND r.active=1').bind(normalized,normalized,authUser.id).all<Binding>()).results;
  if(rows.length!==1||!['owner','admin','recruiter'].includes(rows[0].role))throw new ServiceError('This recruiter account must be linked by an administrator.',403,'account_setup_required');return rows[0];
 }
 async rateLimit(kind:string,identity:string,max:number){const key=await tokenHash(kind+':'+identity.toLowerCase()),now=this.now();await this.db.prepare('DELETE FROM recruiter_login_attempts WHERE attempted_at<?').bind(now-3600000).run();const count=await this.db.prepare('SELECT COUNT(*) AS n FROM recruiter_login_attempts WHERE attempt_key=? AND attempted_at>?').bind(key,now-3600000).first<{n:number}>();if((count?.n??0)>=max)throw new ServiceError('Too many attempts. Try again later.',429,'rate_limited');await this.db.prepare('INSERT INTO recruiter_login_attempts(attempt_key,attempted_at) VALUES(?,?)').bind(key,now).run();}
 private user(row:Binding,authId:string,expiresAt:number):LoginUser{const profile=JSON.parse(row.data_json);profile.id=row.id;profile.accountRole=row.role;profile.contactEmail=row.email;return {userId:authId,recruiterId:row.id,email:row.email,displayName:profile.alias||profile.fullName||row.email,fullName:profile.fullName||null,mustChangePassword:row.must_change===1,expiresAt,actor:{id:row.id,userId:authId,email:row.email,role:row.role,profile}};}
 private async persist(session:Session,binding:Binding,purpose:'login'|'recovery'){
  const token=opaqueToken(),now=this.now(),expiresAt=now+(purpose==='login'?SESSION_MS:15*60000);
  const encrypted=await encryptTokens(this.secret,{access_token:session.access_token,refresh_token:session.refresh_token,expires_at:session.expires_at??now/1000+session.expires_in});
  await this.db.prepare('DELETE FROM recruiter_login_sessions WHERE expires_at<=?').bind(now).run();
  await this.db.prepare('INSERT INTO recruiter_login_sessions(token_hash,recruiter_id,auth_user_id,email,encrypted_tokens,purpose,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(await tokenHash(token),binding.id,session.user.id,binding.email,encrypted,purpose,now,expiresAt).run();
  return {token,user:this.user(binding,session.user.id,expiresAt)};
 }
 async login(email:string,password:string){
  if(email.length>254||password.length>128||!password)throw new ServiceError('Email or password is incorrect.',401,'invalid_credentials');
  await this.rateLimit('login',email.trim(),8);const client=this.makeClient();const {data,error}=await client.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
  if(error||!data.session)throw new ServiceError('Email or password is incorrect.',401,'invalid_credentials');
  const verified=await client.auth.getUser(data.session.access_token);if(verified.error||!verified.data.user||verified.data.user.id!==data.session.user.id)throw new ServiceError('Identity verification failed.',401,'invalid_credentials');
  const binding=await this.binding(verified.data.user);return this.persist(data.session,binding,'login');
 }
 async read(token:string|undefined,purpose:'login'|'recovery'='login'){
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  // The opaque cookie is a random, server-side session handle. Login already
  // verifies the Supabase identity and binds it to a verified recruiter email.
  // Rechecking Supabase /user on every application API call made routine page
  // loads depend on a slow external request (observed up to 115 seconds).
  // Revalidate the session and its active recruiter binding locally instead.
  const row=await this.db.prepare(`SELECT s.token_hash,s.recruiter_id,s.auth_user_id,s.email,s.encrypted_tokens,s.purpose,s.created_at,s.expires_at,
   r.id,r.email,r.role,r.active,r.data_json,b.auth_user_id,b.must_change
   FROM recruiter_login_sessions s
   JOIN recruiters r ON r.id=s.recruiter_id
   JOIN recruiter_login_bindings b ON b.recruiter_id=r.id
   WHERE s.token_hash=? AND s.purpose=? AND s.expires_at>?
    AND r.active=1 AND b.auth_user_id=s.auth_user_id
    AND lower(r.email)=lower(s.email) AND lower(b.verified_email)=lower(s.email)`)
   .bind(await tokenHash(token),purpose,this.now()).first<StoredSession&Binding>();
  if(!row||!sessionValid(row.created_at,row.expires_at,this.now()))return null;
  if(!['owner','admin','recruiter'].includes(row.role))return null;
  let pair;try{pair=await decryptTokens(this.secret,row.encrypted_tokens);}catch{return null;}
  const client=this.makeClient();
  return {user:this.user(row,row.auth_user_id,row.expires_at),pair,row,client};
 }
 async logout(token:string|undefined){if(!token)return;const hash=await tokenHash(token);const row=await this.db.prepare('SELECT encrypted_tokens FROM recruiter_login_sessions WHERE token_hash=?').bind(hash).first<{encrypted_tokens:string}>();await this.db.prepare('DELETE FROM recruiter_login_sessions WHERE token_hash=?').bind(hash).run();if(row)try{const pair=await decryptTokens(this.secret,row.encrypted_tokens);await this.makeClient().auth.admin.signOut(pair.access_token,'local');}catch{/* The app session is already revoked; remote refresh tokens are never sent to clients. */}}
 async requestReset(email:string,origin:string){if(email.length>254)throw new ServiceError('Enter a valid email.');await this.rateLimit('reset',email.trim(),3);const normalized=email.trim().toLowerCase();const bound=await this.db.prepare('SELECT r.id FROM recruiters r JOIN recruiter_login_bindings b ON b.recruiter_id=r.id WHERE lower(r.email)=? AND r.active=1 AND lower(b.verified_email)=?').bind(normalized,normalized).first();if(!bound)return;const {error}=await this.makeClient().auth.resetPasswordForEmail(normalized,{redirectTo:origin+'/auth/recovery'});if(error)throw new ServiceError('Supabase could not accept the recovery request. Check Auth email configuration.',503,'recovery_unavailable');}
 async startRecovery(tokenHashInput:string){if(tokenHashInput.length>1024||!tokenHashInput)throw new ServiceError('Invalid recovery link.');const {data,error}=await this.makeClient().auth.verifyOtp({token_hash:tokenHashInput,type:'recovery'});if(error||!data.session||!data.user)throw new ServiceError('This recovery link is invalid or expired.',400,'invalid_code');const binding=await this.binding(data.user);return this.persist(data.session,binding,'recovery');}
 async changePassword(token:string|undefined,currentPassword:string|undefined,password:string,purpose:'login'|'recovery'='login'){
  validatePassword(password);const session=await this.read(token,purpose);if(!session)throw new ServiceError('Sign in or request a new recovery link.',401,'not_allowed');
  if(purpose==='login'&&!session.user.mustChangePassword){if(!currentPassword)throw new ServiceError('Enter your current password.');const check=await this.makeClient().auth.signInWithPassword({email:session.user.email,password:currentPassword});if(check.error||!check.data.user||check.data.user.id!==session.user.userId)throw new ServiceError('Current password is incorrect.',401,'invalid_credentials');}
  const client=this.makeClient();const assigned=await client.auth.setSession(session.pair);if(assigned.error)throw new ServiceError('Sign in again.',401,'not_allowed');const updated=await client.auth.updateUser({password});if(updated.error)throw new ServiceError('Supabase could not update the password.',503,'password_change_failed');
  await this.db.batch([this.db.prepare('UPDATE recruiter_login_bindings SET must_change=0,updated_at=? WHERE recruiter_id=? AND auth_user_id=?').bind(this.now(),session.user.recruiterId,session.user.userId),this.db.prepare('DELETE FROM recruiter_login_sessions WHERE auth_user_id=?').bind(session.user.userId)]);
  try{await client.auth.signOut({scope:'global'});}catch{/* Local app sessions have already been revoked. */}
 }
}

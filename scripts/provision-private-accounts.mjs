// Server-side only. Default is read-only; --apply provisions the three approved private accounts.
import {createClient as databaseClient} from '@libsql/client';
import {createClient} from '@supabase/supabase-js';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
const roster=[
 {email:'cvetanovicaleksa45@gmail.com',role:'admin',name:'Aleksa Cvetanović',alias:'Alex Jones'},
 {email:'lakikiller09@gmail.com',role:'recruiter',name:'Lazar Jevtic',alias:'John'},
 {email:'mikicn956@gmail.com',role:'recruiter',name:'Nemanja Mikic',alias:'Nate Mitchell'},
];
for(const key of ['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])if(!process.env[key])throw Error(`Missing server configuration: ${key}`);
const url=new URL(process.env.SUPABASE_URL);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co'))throw Error('Use the approved HTTPS Supabase project.');
const db=databaseClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const auth=createClient(url.origin,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}).auth.admin;
let page=1;const users=[];
while(true){const {data,error}=await auth.listUsers({page,perPage:100});if(error)throw Error('Cannot read Supabase Auth users.');users.push(...data.users);if(data.users.length<100)break;page++;}
const plan=[];
for(const item of roster){
 const rows=(await db.execute({sql:'SELECT id,email,role,active,data_json FROM recruiters WHERE lower(email)=?',args:[item.email]})).rows;
 if(rows.length!==1||rows[0].active!==1||rows[0].role!==item.role)throw Error(`Resolve the existing recruiter identity/role before provisioning ${item.email}. No recruiter rows are created or reassigned.`);
 const matches=users.filter(u=>u.email?.toLowerCase()===item.email);if(matches.length>1)throw Error(`Ambiguous Auth identity for ${item.email}`);
 const binding=(await db.execute({sql:'SELECT auth_user_id,verified_email FROM recruiter_login_bindings WHERE recruiter_id=?',args:[rows[0].id]})).rows[0];
 if(binding&&(!matches[0]||binding.auth_user_id!==matches[0].id||binding.verified_email!==item.email))throw Error(`Binding conflict for ${item.email}. Owner review required.`);
 if(matches[0]&&!matches[0].email_confirmed_at)throw Error(`Email confirmation is required for ${item.email}. Existing users are not changed by this script.`);
 plan.push({item,row:rows[0],user:matches[0],binding});
}
console.table(plan.map(p=>({email:p.item.email,role:p.row.role,recruiterId:p.row.id,action:p.binding?'Already linked':p.user?'Link existing Auth user':'Create Auth user and link'})));
if(!process.argv.includes('--apply')){console.log('Dry run only. No writes or messages were sent.');db.close();process.exit(0);}
async function secret(){
 if(!process.stdin.isTTY)throw Error('Run provisioning in an interactive terminal to enter a temporary password without echoing it.');
 const mute=new Writable({write(_chunk,_encoding,next){next();}});
 const input=createInterface({input:process.stdin,output:mute,terminal:true});
 process.stdout.write('Temporary password for NEW accounts only (hidden; 8–128 characters): ');
 const value=await input.question('');input.close();process.stdout.write('\n');
 if(value.length<8||value.length>128)throw Error('Password must have 8–128 characters.');return value;
}
let password=plan.some(p=>!p.user)?await secret():undefined;
try{
 for(const p of plan){
  if(p.binding)continue;
  let user=p.user;
  if(!user){const created=await auth.createUser({email:p.item.email,password,email_confirm:true,user_metadata:{full_name:p.item.name,recruiter_alias:p.item.alias}});if(created.error||!created.data.user)throw Error(`Auth creation failed for ${p.item.email}. Retry is safe; existing users are retained.`);user=created.data.user;}
  // Roles and ownership stay in the existing database. Metadata never grants access.
  await db.execute({sql:'INSERT INTO recruiter_login_bindings(recruiter_id,auth_user_id,verified_email,must_change,updated_at) VALUES(?,?,?,1,?)',args:[p.row.id,user.id,p.item.email,Date.now()]});
  console.log(`Linked ${p.item.email}; existing recruiter ID and assignments preserved.`);
 }
}finally{password=undefined;db.close();}

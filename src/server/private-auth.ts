import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {env} from 'cloudflare:workers';
import {ServiceError} from './access';

export const OWNER_EMAIL='cvetanovicaleksa45@gmail.com';
const COOKIE='tti_private_session';
const SESSION_DAYS=30;
const HASH_ITERATIONS=100000; // Cloudflare Workers rejects PBKDF2 counts above 100,000.
const enc=new TextEncoder();
const schemaReady=new WeakMap<D1Database,Promise<void>>();
const credentialSeedReady=new WeakMap<D1Database,Promise<void>>();
export type PrivateUser={userId:string;email:string;displayName:string;fullName:string|null;mustChangePassword:boolean};
export type AuthMailSettings={HQ_WEBHOOK_URL?:string;HQ_WEBHOOK_SECRET?:string};
type Account={email:string;user_id:string;password_salt:string;password_hash:string};
type LoginState={email:string;must_change:number};
const INITIAL_ACCOUNTS=[
 {email:OWNER_EMAIL,userId:'private-aleksa',name:'Aleksa Cvetanović',password:'aleksa.cvetanovic2026'},
 {email:'lakikiller09@gmail.com',userId:'private-lazar',name:'Lazar Jevtic',password:'lazar.jevtic2026'},
 {email:'mikicn956@gmail.com',userId:'private-nate',name:'Nate Mitchell',password:'nate.mitchell2026'},
] as const;

export async function ensurePrivateAuthSchema(db:D1Database){
 let ready=schemaReady.get(db);
 if(!ready){ready=db.exec(`CREATE TABLE IF NOT EXISTS private_login_accounts(email TEXT PRIMARY KEY,user_id TEXT NOT NULL,password_salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS private_login_sessions(token_hash TEXT PRIMARY KEY,email TEXT NOT NULL,expires_at INTEGER NOT NULL,created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS private_login_sessions_expiry ON private_login_sessions(expires_at); CREATE TABLE IF NOT EXISTS private_login_attempts(email TEXT NOT NULL,attempted_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS private_login_attempts_email_time ON private_login_attempts(email,attempted_at); CREATE TABLE IF NOT EXISTS private_login_state(email TEXT PRIMARY KEY,must_change INTEGER NOT NULL DEFAULT 1,initial_email_sent INTEGER NOT NULL DEFAULT 0,temp_cipher TEXT,temp_iv TEXT,temp_key TEXT,updated_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS private_password_resets(email TEXT PRIMARY KEY,code_salt TEXT NOT NULL,code_hash TEXT NOT NULL,expires_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,sent_at INTEGER NOT NULL,delivery_key TEXT NOT NULL); CREATE TABLE IF NOT EXISTS private_auth_migrations(id TEXT PRIMARY KEY,applied_at INTEGER NOT NULL);`).then(()=>undefined);schemaReady.set(db,ready);}
 await ready;
 let seeded=credentialSeedReady.get(db);
 if(!seeded){seeded=(async()=>{
  if(await db.prepare('SELECT id FROM private_auth_migrations WHERE id=?').bind('named-test-accounts-v1').first())return;
  const now=Date.now(),writes:D1PreparedStatement[]=[];
  for(const account of INITIAL_ACCOUNTS){const salt=crypto.getRandomValues(new Uint8Array(16));writes.push(db.prepare('INSERT INTO private_login_accounts(email,user_id,password_salt,password_hash,created_at) VALUES(?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id,password_salt=excluded.password_salt,password_hash=excluded.password_hash').bind(account.email,account.userId,b64(salt),await passwordHash(account.password,salt),now));writes.push(db.prepare('INSERT INTO private_login_state(email,must_change,initial_email_sent,updated_at) VALUES(?,1,0,?) ON CONFLICT(email) DO UPDATE SET must_change=1,initial_email_sent=0,temp_cipher=NULL,temp_iv=NULL,temp_key=NULL,updated_at=excluded.updated_at').bind(account.email,now));writes.push(db.prepare('DELETE FROM private_login_sessions WHERE email=?').bind(account.email));}
  writes.push(db.prepare('INSERT OR IGNORE INTO private_auth_migrations(id,applied_at) VALUES(?,?)').bind('named-test-accounts-v1',now));await db.batch(writes);
 })();credentialSeedReady.set(db,seeded);}
 await seeded;
}
function b64(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
function unb64(value:string){const s=value.replaceAll('-','+').replaceAll('_','/');return Uint8Array.from(atob(s.padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));}
function randomBytes(length:number){return crypto.getRandomValues(new Uint8Array(length));}
function randomToken(){return b64(randomBytes(32));}
async function digest(value:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));}
async function passwordHash(password:string,salt:Uint8Array){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return b64(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt).buffer as ArrayBuffer,iterations:HASH_ITERATIONS},key,256)));}
function equal(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function validPassword(value:string){return value.length>=8&&value.length<=128;}
function normalizedEmail(value:string){return value.trim().toLowerCase();}
function accountFor(email:string){return INITIAL_ACCOUNTS.find(x=>x.email===email);}
async function state(db:D1Database,email:string){return db.prepare('SELECT * FROM private_login_state WHERE email=?').bind(email).first<LoginState>();}

async function sendAuthEmail(settings:AuthMailSettings,input:{email:string;type:'password_reset';key:string;code:string}){
 const url=settings.HQ_WEBHOOK_URL?.trim(),secret=settings.HQ_WEBHOOK_SECRET?.trim();if(!url||!secret)return false;
 try{const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'sendAuthEmail',webhookSecret:secret,idempotencyKey:input.key,recipient:input.email,emailType:input.type,resetCode:input.code}),signal:AbortSignal.timeout(12000)});const result=await response.json() as {ok?:boolean;email?:{ok?:boolean;status?:string}};return response.ok&&result.ok===true&&result.email?.ok===true&&result.email.status==='sent';}catch{return false;}
}
async function allowMailRequest(db:D1Database,key:string){const now=Date.now();await db.prepare('DELETE FROM private_login_attempts WHERE attempted_at<?').bind(now-60*60_000).run();const row=await db.prepare('SELECT COUNT(*) AS n FROM private_login_attempts WHERE email=? AND attempted_at>?').bind('mail:'+key,now-60*60_000).first<{n:number}>();if((row?.n??0)>=3)return false;await db.prepare('INSERT INTO private_login_attempts(email,attempted_at) VALUES(?,?)').bind('mail:'+key,now).run();return true;}

export async function authStatus(db:D1Database){await ensurePrivateAuthSchema(db);return {configured:true,pending:false};}
export async function signIn(db:D1Database,email:string,password:string){
 const normalized=normalizedEmail(email);await ensurePrivateAuthSchema(db);const now=Date.now();
 await db.prepare('DELETE FROM private_login_attempts WHERE attempted_at<?').bind(now-60*60_000).run();const attempts=await db.prepare('SELECT COUNT(*) AS n FROM private_login_attempts WHERE email=? AND attempted_at>?').bind(normalized,now-60*60_000).first<{n:number}>();if((attempts?.n??0)>=8)throw new ServiceError('Too many attempts. Try again in an hour.',429,'rate_limited');
 const approved=accountFor(normalized),account=approved?await db.prepare('SELECT * FROM private_login_accounts WHERE email=?').bind(normalized).first<Account>():null;const candidate=await passwordHash(password,account?unb64(account.password_salt):new Uint8Array(16));if(!account||!equal(candidate,account.password_hash)){await db.prepare('INSERT INTO private_login_attempts(email,attempted_at) VALUES(?,?)').bind(normalized,now).run();throw new ServiceError('Email or password is incorrect.',401,'invalid_credentials');}
 await db.prepare('DELETE FROM private_login_attempts WHERE email=?').bind(normalized).run();const current=await state(db,normalized);const session=await createSession(db,normalized,account.user_id);return {...session,mustChangePassword:current?.must_change===1};
}
async function createSession(db:D1Database,email:string,userId:string){
 const token=randomToken(),now=Date.now(),expires=now+SESSION_DAYS*86400000;await ensurePrivateAuthSchema(db);await db.prepare('DELETE FROM private_login_sessions WHERE expires_at<=?').bind(now).run();await db.prepare('INSERT INTO private_login_sessions(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(token),email,expires,now).run();const jar=await cookies();jar.set(COOKIE,token,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:SESSION_DAYS*86400});return {userId,email,expiresAt:expires};
}
export async function getPrivateUser(db?:D1Database):Promise<PrivateUser|null>{
 const database=db??env.DB;if(!database)return null;const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;await ensurePrivateAuthSchema(database);
 const session=await database.prepare('SELECT s.email,a.user_id,COALESCE(st.must_change,0) AS must_change FROM private_login_sessions s JOIN private_login_accounts a ON a.email=s.email LEFT JOIN private_login_state st ON st.email=s.email WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token),Date.now()).first<{email:string;user_id:string;must_change:number}>();
 const account=session&&accountFor(session.email);return session&&account?{userId:session.user_id,email:session.email,displayName:account.name,fullName:account.name,mustChangePassword:session.must_change===1}:null;
}
export async function revokePrivateSession(db:D1Database){const jar=await cookies(),token=jar.get(COOKIE)?.value;if(token){await ensurePrivateAuthSchema(db);await db.prepare('DELETE FROM private_login_sessions WHERE token_hash=?').bind(await digest(token)).run();}jar.set(COOKIE,'',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});}
export async function requirePrivateUser(returnTo:string,allowPasswordChange=false){const user=await getPrivateUser();if(user){if(user.mustChangePassword&&!allowPasswordChange)redirect('/change-password?return_to='+encodeURIComponent(returnTo));return user;}const safe=returnTo.startsWith('/')&&!returnTo.startsWith('//')?returnTo:'/';redirect(`/login?return_to=${encodeURIComponent(safe)}`);}
export async function changePrivatePassword(db:D1Database,user:PrivateUser,currentPassword:string|undefined,newPassword:string){
 const email=normalizedEmail(user.email);if(!accountFor(email))throw new ServiceError('This private account is not approved.',401,'not_allowed');if(!validPassword(newPassword))throw new ServiceError('Use a password between 8 and 128 characters.');await ensurePrivateAuthSchema(db);const account=await db.prepare('SELECT * FROM private_login_accounts WHERE email=?').bind(email).first<Account>();if(!account)throw new ServiceError('Private login is not set up.',401,'not_allowed');
 if(!user.mustChangePassword){if(!currentPassword||!equal(await passwordHash(currentPassword,unb64(account.password_salt)),account.password_hash))throw new ServiceError('Current password is incorrect.',401,'invalid_credentials');}
 const salt=randomBytes(16);await db.prepare('UPDATE private_login_accounts SET password_salt=?,password_hash=? WHERE email=?').bind(b64(salt),await passwordHash(newPassword,salt),email).run();await db.prepare('INSERT INTO private_login_state(email,must_change,initial_email_sent,updated_at) VALUES(?,0,1,?) ON CONFLICT(email) DO UPDATE SET must_change=0,initial_email_sent=1,temp_cipher=NULL,temp_iv=NULL,temp_key=NULL,updated_at=excluded.updated_at').bind(email,Date.now()).run();await db.prepare('DELETE FROM private_password_resets WHERE email=?').bind(email).run();
}
export async function requestPrivatePasswordReset(db:D1Database,emailInput:string,settings:AuthMailSettings){
 const email=normalizedEmail(emailInput);await ensurePrivateAuthSchema(db);if(!accountFor(email)||!await allowMailRequest(db,'reset:'+email))return true;const account=await db.prepare('SELECT email FROM private_login_accounts WHERE email=?').bind(email).first();if(!account)return true;
 const salt=randomBytes(16),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1_000_000).padStart(6,'0'),key='private-password-reset:'+crypto.randomUUID(),now=Date.now();await db.prepare('INSERT INTO private_password_resets(email,code_salt,code_hash,expires_at,attempts,sent_at,delivery_key) VALUES(?,?,?,?,0,?,?) ON CONFLICT(email) DO UPDATE SET code_salt=excluded.code_salt,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,sent_at=excluded.sent_at,delivery_key=excluded.delivery_key').bind(email,b64(salt),await passwordHash(code,salt),now+15*60_000,now,key).run();return sendAuthEmail(settings,{email,type:'password_reset',key,code});
}
export async function resetPrivatePassword(db:D1Database,emailInput:string,code:string,newPassword:string){
 const email=normalizedEmail(emailInput);if(!accountFor(email))throw new ServiceError('That code is invalid or expired. Request a new one.',400,'invalid_code');if(!validPassword(newPassword))throw new ServiceError('Use a password between 8 and 128 characters.');await ensurePrivateAuthSchema(db);const reset=await db.prepare('SELECT * FROM private_password_resets WHERE email=?').bind(email).first<{code_salt:string;code_hash:string;expires_at:number;attempts:number}>();if(!reset||reset.expires_at<=Date.now()||reset.attempts>=5)throw new ServiceError('That code is invalid or expired. Request a new one.',400,'invalid_code');
 if(!equal(await passwordHash(code,unb64(reset.code_salt)),reset.code_hash)){await db.prepare('UPDATE private_password_resets SET attempts=attempts+1 WHERE email=?').bind(email).run();throw new ServiceError('That code is invalid or expired. Request a new one.',400,'invalid_code');}
 const salt=randomBytes(16);await db.prepare('UPDATE private_login_accounts SET password_salt=?,password_hash=? WHERE email=?').bind(b64(salt),await passwordHash(newPassword,salt),email).run();await db.prepare('INSERT INTO private_login_state(email,must_change,initial_email_sent,updated_at) VALUES(?,0,1,?) ON CONFLICT(email) DO UPDATE SET must_change=0,initial_email_sent=1,temp_cipher=NULL,temp_iv=NULL,temp_key=NULL,updated_at=excluded.updated_at').bind(email,Date.now()).run();await db.prepare('DELETE FROM private_password_resets WHERE email=?').bind(email).run();await db.prepare('DELETE FROM private_login_sessions WHERE email=?').bind(email).run();
}

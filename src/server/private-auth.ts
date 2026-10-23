// Compatibility exports for the approved private login UI. Authentication is now Supabase-owned.
import 'server-only';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {createClient} from '@supabase/supabase-js';
import {env} from './platform';
import {ServiceError} from './access';
import {safeReturnPath,SESSION_MS} from './security-policy';
import {AuthEngine,type LoginUser} from './auth/engine';
export type PrivateUser=LoginUser;
export const OWNER_EMAIL='cvetanovicaleksa45@gmail.com';
const COOKIE='tti_session',RECOVERY_COOKIE='tti_recovery';
function engine(db:D1Database){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secret=process.env.AUTH_SESSION_ENCRYPTION_KEY;
 if(!url||!key||!secret)throw new ServiceError('Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and AUTH_SESSION_ENCRYPTION_KEY on the server.',503,'not_configured');
 const parsed=new URL(url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co'))throw new ServiceError('Use the approved HTTPS Supabase project URL.',503,'not_configured');
 return new AuthEngine(db,()=>createClient(parsed.origin,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),secret);
}
function database(db?:D1Database){const value=db??env.DB;if(!value)throw new ServiceError('Application database is not configured.',503,'not_configured');return value;}
async function writeCookie(name:string,value:string,maxAge:number){(await cookies()).set(name,value,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge});}
export async function authStatus(db:D1Database){
 const checks={
  databaseUrl:Boolean(process.env.SUPABASE_DATABASE_URL?.trim()),
  supabaseUrl:Boolean(process.env.SUPABASE_URL?.trim()),
  publishableKey:Boolean(process.env.SUPABASE_PUBLISHABLE_KEY?.trim()),
  sessionEncryptionKey:Boolean(process.env.AUTH_SESSION_ENCRYPTION_KEY?.trim()),
 };
 let sessionStoreReady=false;
 try{await db.prepare('SELECT token_hash FROM recruiter_login_sessions LIMIT 0').all();sessionStoreReady=true;}catch{/* Expose readiness only, never database details or secret values. */}
 return {configured:Object.values(checks).every(Boolean)&&sessionStoreReady,pending:false,checks:{...checks,sessionStoreReady}};
}
export async function signIn(db:D1Database,email:string,password:string){const login=await engine(db).login(email,password);await writeCookie(COOKIE,login.token,SESSION_MS/1000);return login.user;}
export async function getPrivateUser(db?:D1Database):Promise<LoginUser|null>{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const session=await engine(database(db)).read(token);return session?.user??null;}
export async function requirePrivateUser(returnTo:string,allowPasswordChange=false){const user=await getPrivateUser();if(user){if(user.mustChangePassword&&!allowPasswordChange)redirect('/change-password?return_to='+encodeURIComponent(safeReturnPath(returnTo)));return user;}redirect('/login?return_to='+encodeURIComponent(safeReturnPath(returnTo)));}
export async function revokePrivateSession(db:D1Database){const token=(await cookies()).get(COOKIE)?.value;await engine(db).logout(token);await writeCookie(COOKIE,'',0);await writeCookie(RECOVERY_COOKIE,'',0);}
export async function changePrivatePassword(db:D1Database,_user:LoginUser,currentPassword:string|undefined,newPassword:string){await engine(db).changePassword((await cookies()).get(COOKIE)?.value,currentPassword,newPassword);await writeCookie(COOKIE,'',0);await writeCookie(RECOVERY_COOKIE,'',0);}
export async function requestPrivatePasswordReset(db:D1Database,email:string,origin:string){await engine(db).requestReset(email,origin);return true;}
export async function beginRecovery(tokenHash:string){const result=await engine(database()).startRecovery(tokenHash);await writeCookie(RECOVERY_COOKIE,result.token,15*60);}
export async function hasRecoverySession(){const token=(await cookies()).get(RECOVERY_COOKIE)?.value;if(!token)return false;return Boolean(await engine(database()).read(token,'recovery'));}
export async function resetPrivatePassword(db:D1Database,password:string){await engine(db).changePassword((await cookies()).get(RECOVERY_COOKIE)?.value,undefined,password,'recovery');await writeCookie(COOKIE,'',0);await writeCookie(RECOVERY_COOKIE,'',0);}

import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {ServiceError,type Actor} from './access.ts';
import {provisionRecruiterLoginCore,type AuthAdmin,type ProvisionDependencies} from './recruiter-login-provisioning-core.ts';

export async function provisionRecruiterLogin(db:D1Database,actor:Actor,input:unknown,origin:string){
 const url=process.env.SUPABASE_URL?.trim(),publishable=process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),secret=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),sessionKey=process.env.AUTH_SESSION_ENCRYPTION_KEY?.trim();
 if(!url||!publishable||!secret||!sessionKey)throw new ServiceError('Login setup needs SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, AUTH_SESSION_ENCRYPTION_KEY, and the server-only SUPABASE_SERVICE_ROLE_KEY in Vercel Production.',503,'auth_setup_not_configured');
 const parsed=new URL(url);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith('.supabase.co'))throw new ServiceError('Use the configured HTTPS Supabase project for login setup.',503,'auth_setup_not_configured');
 const adminClient=createClient(parsed.origin,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const dependencies:ProvisionDependencies={admin:adminClient.auth.admin as unknown as AuthAdmin};
 return provisionRecruiterLoginCore(db,actor,input,origin,dependencies);
}

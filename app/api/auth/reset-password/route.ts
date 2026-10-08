import {env} from 'cloudflare:workers';
import {checkOrigin,failure} from '@/src/server/runtime';
import {resetPrivatePassword} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{checkOrigin(r);if(!env.DB)throw new Error('Private test database unavailable.');const body=await r.json() as {email?:unknown;code?:unknown;password?:unknown;confirmPassword?:unknown};if(typeof body.email!=='string'||typeof body.code!=='string'||typeof body.password!=='string'||body.password!==body.confirmPassword)throw new Error('Enter the account email, reset code, and matching new passwords.');await resetPrivatePassword(env.DB,body.email,body.code,body.password);return Response.json({ok:true,message:'Password reset. Sign in with your new password.'},{headers:{'cache-control':'no-store'}});}catch(e){return failure(e);}}

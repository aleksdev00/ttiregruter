import {env} from 'cloudflare:workers';
import {checkOrigin,failure} from '@/src/server/runtime';
import {requestPrivatePasswordReset} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{checkOrigin(r);if(!env.DB)throw new Error('Private test database unavailable.');const body=await r.json() as {email?:unknown};if(typeof body.email!=='string')throw new Error('Enter your approved email address.');const sent=await requestPrivatePasswordReset(env.DB,body.email,env);if(!sent)throw new Error('The reset email could not be confirmed. Try again later.');return Response.json({ok:true,message:'If this is an approved account and email delivery is configured, a reset code has been sent.'},{headers:{'cache-control':'no-store'}});}catch(e){return failure(e);}}

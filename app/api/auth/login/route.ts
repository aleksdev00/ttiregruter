import {env} from '@/src/server/platform';
import {checkOrigin,failure} from '@/src/server/runtime';
import {signIn} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{checkOrigin(r);if(!env.DB)throw new Error('Private test database unavailable.');const body=await r.json() as {email?:unknown;password?:unknown};if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length>128)throw new Error('Enter your email and password.');const session=await signIn(env.DB,body.email,body.password);return Response.json({ok:true,value:{email:session.email,mustChangePassword:session.mustChangePassword}},{headers:{'cache-control':'no-store'}});}catch(e){return failure(e);}}

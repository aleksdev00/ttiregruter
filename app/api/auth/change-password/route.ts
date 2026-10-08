import {env} from '@/src/server/platform';
import {checkOrigin,failure} from '@/src/server/runtime';
import {changePrivatePassword,getPrivateUser} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{checkOrigin(r);if(!env.DB)throw new Error('Private test database unavailable.');const user=await getPrivateUser(env.DB);if(!user)throw new Error('Sign in to continue.');const body=await r.json() as {currentPassword?:unknown;password?:unknown;confirmPassword?:unknown};if(typeof body.password!=='string'||body.password!==body.confirmPassword||body.currentPassword!==undefined&&typeof body.currentPassword!=='string')throw new Error('Enter matching new passwords.');await changePrivatePassword(env.DB,user,body.currentPassword as string|undefined,body.password);return Response.json({ok:true},{headers:{'cache-control':'no-store'}});}catch(e){return failure(e);}}

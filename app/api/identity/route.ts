import {env} from '@/src/server/platform';
import {getPrivateUser} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function GET(){const user=env.DB?await getPrivateUser(env.DB):null;return Response.json(user?{ok:true,value:{userId:user.userId,email:user.email,displayName:user.displayName}}:{ok:false,message:'Sign in with your private test email and password.'},{status:user?200:401,headers:{'cache-control':'private, no-store'}});}

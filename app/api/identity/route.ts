import {getChatGPTUser} from '@/app/chatgpt-auth';
export const dynamic='force-dynamic';
export async function GET(){const user=await getChatGPTUser();return Response.json(user?{ok:true,value:{userId:user.userId,email:user.email,displayName:user.displayName}}:{ok:false,message:'Sign in with your recruiter account.'},{status:user?200:401,headers:{'cache-control':'private, no-store'}});}

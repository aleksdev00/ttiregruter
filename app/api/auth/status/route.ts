import {env} from 'cloudflare:workers';
import {authStatus} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function GET(){if(!env.DB)return Response.json({ok:false,message:'Private test database unavailable.'},{status:503,headers:{'cache-control':'no-store'}});return Response.json({ok:true,...await authStatus(env.DB)},{headers:{'cache-control':'no-store'}});}

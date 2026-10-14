import {env} from '@/src/server/platform';import {failure,json} from '@/src/server/runtime';import {authStatus} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function GET(){try{return json({ok:true,value:env.DB?await authStatus(env.DB):{configured:false,pending:false}});}catch(e){return failure(e);}}

import {env} from 'cloudflare:workers';
import {runtime,failure,json,checkOrigin} from '@/src/server/runtime';
import {requireAdmin} from '@/src/server/access';
import {checkHQConnection} from '@/src/server/hq';
export async function POST(request:Request){try{checkOrigin(request);const {actor}=await runtime();requireAdmin(actor);return json({ok:true,value:await checkHQConnection({url:env.HQ_WEBHOOK_URL,secret:env.HQ_WEBHOOK_SECRET})});}catch(error){return failure(error);}}

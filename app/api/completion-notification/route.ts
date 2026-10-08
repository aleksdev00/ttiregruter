import {env} from '@/src/server/platform';
import {z} from 'zod';
import {runtime,failure,json,checkOrigin} from '@/src/server/runtime';
import {notificationRecord,publicNotification,deliverCompletion} from '@/src/server/completion-notifications';
export async function GET(request:Request){try{const {db,actor}=await runtime(false);return json({ok:true,value:publicNotification(await notificationRecord(db,actor,new URL(request.url).searchParams.get('conversationId')??''))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{checkOrigin(request);const {db,actor}=await runtime(false);const p=z.object({conversationId:z.string().min(1).max(200),operation:z.enum(['retry','check'])}).strict().parse(await request.json());return json({ok:true,value:await deliverCompletion(db,actor,p.conversationId,{url:env.HQ_WEBHOOK_URL,secret:env.HQ_WEBHOOK_SECRET},p.operation)});}catch(e){return failure(e);}}

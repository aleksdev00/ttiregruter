import {env} from '@/src/server/platform';
import {deliverCompletion} from '@/src/server/completion-notifications';
import {z} from 'zod';
import {runtime,failure,json,checkOrigin} from '@/src/server/runtime';
import {loadSnapshot,workflowMutation} from '@/src/server/store';
export const dynamic='force-dynamic';
export async function GET(){try{const {db,actor}=await runtime();return json({ok:true,value:await loadSnapshot(db,actor)});}catch(e){return failure(e);}}
export async function POST(request:Request){try{checkOrigin(request);const {db,actor}=await runtime();const input=z.object({method:z.string().max(60),args:z.array(z.unknown()).max(8)}).strict().parse(await request.json());const result=await workflowMutation(db,actor,input.method,input.args,true);if(!result.ok)return json(result);if(['finish','suppressContact'].includes(input.method)){try{await deliverCompletion(db,actor,String(input.args[0]),{url:env.HQ_WEBHOOK_URL,secret:env.HQ_WEBHOOK_SECRET});}catch{/* The durable pending record remains accessible after a saved completion. */}}
 const id=String(input.args[0]??''),contactId=input.method==='claimContact'?id:(await db.prepare('SELECT driver_id FROM conversations WHERE id=? AND recruiter_id=?').bind(id,actor.id).first<{driver_id:string}>())?.driver_id??'';
 const conversationId=input.method==='claimContact'?(result.value as {id?:string})?.id??'':id;
 try{const snapshotPatch=await loadSnapshot(db,actor,{contactId,conversationId});return json({...result,snapshotPatch});}catch{return json(result);}}catch(e){return failure(e);}}

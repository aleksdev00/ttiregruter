import {z} from 'zod';
import {runtime,failure,json,checkOrigin} from '@/src/server/runtime';
import {loadSnapshot,workflowMutation} from '@/src/server/store';
export const dynamic='force-dynamic';
export async function GET(){try{const {db,actor}=await runtime();return json({ok:true,value:await loadSnapshot(db,actor)});}catch(e){return failure(e);}}
export async function POST(request:Request){try{checkOrigin(request);const {db,actor}=await runtime(),started=performance.now();const input=z.object({method:z.string().max(60),args:z.array(z.unknown()).max(8)}).strict().parse(await request.json()),optimized=request.headers.get('X-TTI-Perf-Mode')!=='baseline';
 if(input.method==='recordCommunication')return json({ok:false,code:'not_allowed',message:'External application destinations are disabled in the private test.'});
 const result=await workflowMutation(db,actor,input.method,input.args,optimized);
 if(!result.ok)return json(result);
 if(!optimized)return json({...result,privateMetrics:{serverMs:performance.now()-started,mode:'baseline'}});
 const id=String(input.args[0]),contactId=input.method==='claimContact'?id:(await db.prepare('SELECT driver_id FROM conversations WHERE id=? AND recruiter_id=?').bind(id,actor.id).first<{driver_id:string}>())?.driver_id??'';
 const patch=await loadSnapshot(db,actor,{contactId,conversationId:input.method==='claimContact'?((result.value as {id?:string})?.id??''):id});
 return json({...result,snapshotPatch:patch,privateMetrics:{serverMs:performance.now()-started,mode:'optimized',loadedContacts:patch.contacts.length}});
 }catch(e){return failure(e);}}

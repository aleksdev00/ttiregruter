import {currentRevision,guardedBatch} from './store.ts';
// Fixed owner-authorized release migration. No request data, caller-supplied
// identity, external delivery, or generalized public write endpoint is used.
const email='cvetanovicaleksa45@gmail.com';
const alexMarker='requested-demo-removal:alex:20261005';
const allMarker='requested-demo-removal:all:20261005';
export const alexLaptopRemovalMarker='requested-demo-removal:alex-laptop:20261005-evening';
const demoPredicate="(json_extract(data_json,'$.isDemo')=1 OR json_extract(data_json,'$.rawFields.demo_contact')=1) AND json_extract(data_json,'$.rawFields.demoRemovedAt') IS NULL";
const predicate="owner_id=(SELECT id FROM recruiters WHERE lower(trim(email))=?) AND "+demoPredicate;
export const applyRequestedDemoRemoval=(db:D1Database)=>applyDemoRemoval(db,false);
export const applyRequestedAllDemoRemoval=(db:D1Database)=>applyDemoRemoval(db,true);
export const applyRequestedAlexLaptopDemoRemoval=(db:D1Database)=>applyDemoRemoval(db,false,alexLaptopRemovalMarker);
async function applyDemoRemoval(db:D1Database,allAccounts:boolean,releaseMarker?:string){
 const marker=releaseMarker??(allAccounts?allMarker:alexMarker);
 const where=allAccounts?demoPredicate:predicate;
 const query=(sql:string)=>allAccounts?db.prepare(sql):db.prepare(sql).bind(email);
 const prior=await db.prepare('SELECT data_json FROM audit WHERE id=?').bind(marker).first<{data_json:string}>();
 if(prior){const result=JSON.parse(prior.data_json);return {removed:result.removed as number,remaining:result.remaining as number};}
 const accounts=await db.prepare('SELECT id FROM recruiters WHERE lower(trim(email))=?').bind(email).all<{id:string}>();
 if(accounts.results.length!==1)return {removed:0,remaining:null};
 const owner=accounts.results[0].id,revision=await currentRevision(db),now=Date.now();
 const rows=await query(`SELECT * FROM drivers WHERE ${where}`).all<{id:string;data_json:string}>();
 const count=await query(`SELECT COUNT(*) AS n FROM drivers WHERE ${where}`).first<{n:number}>();
 if(count?.n!==rows.results.length)throw new Error('Demo cleanup snapshot is incomplete; no records changed.');
 const ids=JSON.stringify(rows.results.map(x=>x.id));
 const statements:D1PreparedStatement[]=rows.results.map(row=>db.prepare("INSERT INTO audit(id,actor_id,driver_id,type,at,data_json) SELECT ?,?,?,'demo_contact_archived',?,json_object('release',?,'driver',json(?),'conversations',json(COALESCE((SELECT json_group_array(json_object('id',id,'status',status,'data_json',json(data_json))) FROM conversations WHERE driver_id=?),'[]')),'tasks',json(COALESCE((SELECT json_group_array(json_object('id',id,'status',status,'data_json',json(data_json))) FROM tasks WHERE driver_id=?),'[]')))" ).bind(marker+':'+row.id,owner,row.id,now,marker,JSON.stringify(row),row.id,row.id));
 statements.push(
 db.prepare("UPDATE conversations SET status='cancelled',data_json=json_set(data_json,'$.status','cancelled','$.closedAt',?,'$.updatedAt',?,'$.activeStepId','finished','$.playbook.flow.stage','finished','$.revision',COALESCE(json_extract(data_json,'$.revision'),0)+1) WHERE driver_id IN (SELECT value FROM json_each(?)) AND status IN ('active','paused')").bind(new Date(now).toISOString(),new Date(now).toISOString(),ids),
 db.prepare("UPDATE tasks SET status='cancelled' WHERE driver_id IN (SELECT value FROM json_each(?)) AND status='pending'").bind(ids),
 db.prepare("UPDATE drivers SET next_action='Demo contact removed by owner request',data_json=json_set(data_json,'$.status',CASE WHEN json_extract(data_json,'$.status')='do_not_contact' THEN 'do_not_contact' ELSE 'closed' END,'$.reservedBy',NULL,'$.activeConversationId',NULL,'$.callbackAt',NULL,'$.rawFields.demoRemovedAt',?,'$.rawFields.demoRemovalRelease',?) WHERE id IN (SELECT value FROM json_each(?))").bind(now,marker,ids),
 db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'requested_demo_removal',?,?)").bind(marker,owner,now,JSON.stringify({removed:rows.results.length,remaining:0,noExternalActions:true})),
 );
 await guardedBatch(db,revision,statements);
 return {removed:rows.results.length,remaining:0};
}

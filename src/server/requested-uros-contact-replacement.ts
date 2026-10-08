import type {Contact} from '../contracts/index.ts';
import {displayName,isGenericContactName} from '../domain/rules.ts';
import {reliableImportedName} from './contact-migration.ts';
import {eligibleAssignmentSQL} from './assignment-eligibility.ts';
import {guardedBatch,currentRevision} from './store.ts';
const marker='requested-named-contact-replacement:urosmladenovice25:20261006';
const untouched="d.blocked=0 AND d.duplicate=0 AND json_extract(d.data_json,'$.status')='available' AND json_extract(d.data_json,'$.activeConversationId') IS NULL AND json_extract(d.data_json,'$.reservedBy') IS NULL AND json_extract(d.data_json,'$.callbackAt') IS NULL AND NOT EXISTS(SELECT 1 FROM conversations c WHERE c.driver_id=d.id) AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.driver_id=d.id) AND NOT EXISTS(SELECT 1 FROM tasks t WHERE t.driver_id=d.id AND t.status='pending') AND NOT EXISTS(SELECT 1 FROM quo_line_allocations q WHERE q.driver_id=d.id)";
const named="json_extract(d.data_json,'$.nameEvidence') IN ('explicit_source','driver_confirmed') AND length(trim(COALESCE(json_extract(d.data_json,'$.firstName'),'')))>0 AND length(trim(COALESCE(json_extract(d.data_json,'$.lastName'),'')))>0";
type DriverRow={id:string;owner_id:string|null;data_json:string};
type Summary={replaced:number;protected:number;missing:number;status:string};
export async function replaceRequestedUrosContacts(db:D1Database,bucket:R2Bucket):Promise<Summary|null>{
 const prior=await db.prepare('SELECT data_json FROM audit WHERE id=?').bind(marker).first<{data_json:string}>();if(prior)return JSON.parse(prior.data_json).summary;
 const accounts=await db.prepare('SELECT id FROM recruiters WHERE lower(trim(email))=? AND active=1').bind('urosmladenovice25@gmail.com').all<{id:string}>();if(accounts.results.length!==1)return null;const owner=accounts.results[0].id;
 const all=await db.prepare("SELECT d.* FROM drivers d WHERE d.owner_id=? AND json_extract(d.data_json,'$.rawFields.demoRemovedAt') IS NULL").bind(owner).all<DriverRow>();
 const missing=all.results.filter(r=>displayName(JSON.parse(r.data_json))==='Name not recorded');
 const eligible=await db.prepare('SELECT d.id FROM drivers d WHERE d.owner_id=? AND '+untouched).bind(owner).all<{id:string}>(),ids=new Set(eligible.results.map(x=>x.id));
 const outgoing=missing.filter(r=>ids.has(r.id)),summary:Summary={replaced:0,protected:missing.length-outgoing.length,missing:missing.length,status:'pending'};
 const candidates=outgoing.length?await db.prepare('SELECT d.* FROM drivers d WHERE '+eligibleAssignmentSQL+' AND '+untouched+' AND '+named+' ORDER BY d.id LIMIT ?').bind(outgoing.length*3).all<DriverRow>():{results:[]};
 const incoming=candidates.results.filter(r=>{const c=JSON.parse(r.data_json) as Contact,name=displayName(c);return name!=='Name not recorded'&&!isGenericContactName(name)&&!!reliableImportedName(name);}).slice(0,outgoing.length);
 if(incoming.length!==outgoing.length)return {...summary,status:'insufficient_named_contacts'};
 const revision=await currentRevision(db),now=Date.now(),backupKey='contact-replacements/uros-20261006/before.json';
 await bucket.put(backupKey,JSON.stringify({owner,outgoing,incoming}));if(!(await bucket.head(backupKey)))return {...summary,status:'backup_failed'};
 const oldIds=JSON.stringify(outgoing.map(x=>x.id)),newIds=JSON.stringify(incoming.map(x=>x.id)),guard=crypto.randomUUID();summary.replaced=incoming.length;summary.missing-=incoming.length;summary.status='completed';
 await guardedBatch(db,revision,[
 db.prepare(`INSERT INTO mutation_guards(id,ok) SELECT ?,CASE WHEN (SELECT COUNT(*) FROM drivers d WHERE d.owner_id=? AND ${untouched} AND d.id IN (SELECT value FROM json_each(?)))=? AND (SELECT COUNT(*) FROM drivers d WHERE ${eligibleAssignmentSQL} AND ${untouched} AND d.id IN (SELECT value FROM json_each(?)))=? THEN 1 ELSE 0 END`).bind(guard,owner,oldIds,outgoing.length,newIds,incoming.length),
 db.prepare("UPDATE drivers SET owner_id=NULL,data_json=json_set(data_json,'$.ownerRecruiterId',NULL) WHERE id IN (SELECT value FROM json_each(?)) AND owner_id=?").bind(oldIds,owner),
 db.prepare("UPDATE drivers SET owner_id=?,batch_id=?,data_json=json_set(data_json,'$.ownerRecruiterId',?) WHERE id IN (SELECT value FROM json_each(?)) AND owner_id IS NULL").bind(owner,marker,owner,newIds),
 db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'requested_named_contact_replacement',?,?)").bind(marker,owner,now,JSON.stringify({summary,backupKey,outgoingIds:outgoing.map(x=>x.id),incomingIds:incoming.map(x=>x.id),authorizedBy:'Account administrator requested replacement of unnamed contacts',noExternalActions:true,noRecordsDeleted:true})),
 db.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
 ]);
 return summary;
}

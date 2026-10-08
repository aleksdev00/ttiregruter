import {z} from 'zod';
import {requireAdmin,ServiceError,type Actor} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';
import {WORKBOOK_SOURCE} from './contact-migration.ts';

// Release only the initial workbook review hold. Never reopen a recorded call
// outcome, callback, reservation, duplicate, invalid number or suppression.
export const readinessFilter=`blocked=0 AND duplicate=0 AND phone IS NOT NULL
 AND json_extract(data_json,'$.rawFields.legacy_source_project')=?
 AND json_extract(data_json,'$.rawFields.lead_status')='needs_review'
 AND json_extract(data_json,'$.status')='closed'
 AND COALESCE(json_extract(data_json,'$.rawFields.contact_blocked'),0)=0
 AND COALESCE(json_extract(data_json,'$.rawFields.last_call_outcome'),'')!='do_not_contact'
 AND json_extract(data_json,'$.phoneNormalized')=phone
 AND json_extract(data_json,'$.activeConversationId') IS NULL
 AND json_extract(data_json,'$.reservedBy') IS NULL
 AND json_extract(data_json,'$.callbackAt') IS NULL
 AND NOT EXISTS(SELECT 1 FROM conversations c WHERE c.driver_id=drivers.id)`;
export const releaseSchema=z.object({runId:z.string().uuid(),cursor:z.string().max(200),evidence:z.string().trim().min(10).max(500)}).strict();
export async function releaseImportedContacts(db:D1Database,bucket:R2Bucket,a:Actor,input:unknown){
 requireAdmin(a);const p=releaseSchema.parse(input),receiptId=a.id+':contact-readiness:'+p.runId+':'+p.cursor,fingerprint=JSON.stringify(p);
 const prior=await db.prepare('SELECT fingerprint,data_json FROM mutation_receipts WHERE id=? AND actor_id=?').bind(receiptId,a.id).first<{fingerprint:string;data_json:string}>();
 if(prior){if(prior.fingerprint!==fingerprint)throw new ServiceError('This release request has changed.',409,'conflict');return JSON.parse(prior.data_json) as ReleaseResult;}
 const revision=await currentRevision(db);
 const rows=await db.prepare('SELECT * FROM drivers WHERE id>? AND '+readinessFilter+' ORDER BY id LIMIT 500').bind(p.cursor,WORKBOOK_SOURCE).all<{id:string;data_json:string}>();
 const nextCursor=rows.results.at(-1)?.id??p.cursor,now=new Date().toISOString(),backupKey='contact-readiness/'+a.id+'/'+p.runId+'/'+encodeURIComponent(p.cursor||'start')+'.json';
 await bucket.put(backupKey,JSON.stringify({actorId:a.id,evidence:p.evidence,before:rows.results,createdAt:now}));
 if(!(await bucket.head(backupKey)))throw new ServiceError('The recoverable contact backup could not be verified.',503,'storage_failed');
 const value:ReleaseResult={released:rows.results.length,nextCursor,complete:rows.results.length<500,backupSaved:true};
 await guardedBatch(db,revision,[
  db.prepare(`UPDATE drivers SET next_action='Available for recruiter call',data_json=json_set(data_json,'$.status','available','$.rawFields.call_readiness_review','approved','$.rawFields.call_readiness_approved_by',?,'$.rawFields.call_readiness_approved_at',?,'$.rawFields.call_readiness_evidence',?) WHERE id IN (SELECT value FROM json_each(?)) AND ${readinessFilter}`).bind(a.id,now,p.evidence,JSON.stringify(rows.results.map(r=>r.id)),WORKBOOK_SOURCE),
  db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'imported_contacts_released',?,?)").bind(receiptId,a.id,Date.parse(now),JSON.stringify({count:value.released,evidence:p.evidence,backupKey,noExternalActions:true,ownershipUnchanged:true})),
  db.prepare('INSERT INTO mutation_receipts(id,actor_id,fingerprint,data_json) VALUES(?,?,?,?)').bind(receiptId,a.id,fingerprint,JSON.stringify(value)),
 ]);return value;
}
export interface ReleaseResult {released:number;nextCursor:string;complete:boolean;backupSaved:boolean}

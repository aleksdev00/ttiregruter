import {z} from 'zod';
import type {Contact,Recruiter} from '../contracts/index.ts';
import {normalizePhone,requireAdmin,ServiceError,type Actor} from './access.ts';
import {guardedBatch,currentRevision} from './store.ts';
export const LEGACY_SOURCE='appgprj_6ab6dcea10788191a8a7b20f874a3549';
export const WORKBOOK_SOURCE='owner-contact-workbooks';
const row=z.record(z.union([z.string(),z.number(),z.boolean(),z.null()]));
export const manifestSchema=z.object({schemaVersion:z.literal(1),sourceProjectId:z.enum([LEGACY_SOURCE,WORKBOOK_SOURCE]),extractedAt:z.string().datetime(),driver_profiles:z.array(row).max(100000),owner_operator_contacts:z.array(row).max(100000),recruiters:z.array(row).max(1000),contact_batches:z.array(row).max(10000),contact_batch_items:z.array(row).max(100000),review:z.object({summary:z.record(z.number()),records:z.array(row).max(100000)}).optional()}).strict();
type Row=z.infer<typeof row>;export type Manifest=z.infer<typeof manifestSchema>;
type RecruiterRow={id:string;email:string;active:number;data_json:string};
type DriverRow={id:string;phone:string|null;blocked:number;duplicate:number;owner_id:string|null;batch_id:string|null;next_action:string;data_json:string};
export interface MigrationItem {contact:Contact;sourceKey:string;recordJson:string;blocked:number;duplicate:number;batchId:string|null;nextAction:string;review:string[]}
const str=(v:unknown)=>typeof v==='string'&&v.trim()?v:null;
const email=(v:unknown)=>str(v)?.trim().toLowerCase()??null;
const iso=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0?new Date(v).toISOString():null;
export function reliableImportedName(value:unknown){
 const name=str(value)?.trim();if(!name||name.length>100||/[\d@]/.test(name)||!/^[\p{L}][\p{L}'’.\-]*(?:\s+[\p{L}][\p{L}'’.\-]*)*$/u.test(name))return null;
 if(/^(starts?|available|availability|asap|not interested|no answer|do not contact|unknown|not recorded|dry van|reefer|flatbed|owner operator|lease purchase)$/i.test(name)||/^(starts?\s+|(?:in|next|within|after)\s+).*\b(days?|weeks?|months?)\b/i.test(name))return null;
 return name;
}
export function mapLegacyContacts(m:Manifest,recruiters:RecruiterRow[]){
 const newByEmail=new Map(recruiters.map(r=>[r.email.toLowerCase(),r]));
 const oldById=new Map(m.recruiters.map(r=>[String(r.id),r]));
 const ownerPhones=new Map(m.owner_operator_contacts.map(r=>[normalizePhone(String(r.phone_e164??'')),r]));
 const batchByDriver=new Map<string,Row[]>();for(const r of m.contact_batch_items){const id=String(r.driver_profile_id);batchByDriver.set(id,[...(batchByDriver.get(id)??[]),r]);}
 const profiles=[...m.driver_profiles];const profilePhones=new Set(profiles.map(r=>normalizePhone(String(r.phone_e164??''))));
 const orphans=m.owner_operator_contacts.filter(r=>!profilePhones.has(normalizePhone(String(r.phone_e164??''))));
 for(const r of orphans)profiles.push({id:'owner:'+String(r.phone_e164),phone_e164:r.phone_e164,created_at:r.created_at,source:'Owner operator contact registry',lead_status:'new'});
 const items:MigrationItem[]=profiles.map(r=>{
  const id=String(r.id),ownerId=str(r.assigned_recruiter_id),ownerRecord=ownerId?oldById.get(ownerId):undefined;
  const assignedEmail=email(r.assigned_email),ownerEmail=email(ownerRecord?.email),review:string[]=[];
  if(ownerId&&!ownerRecord)review.push('Unknown source recruiter ID');
  if(assignedEmail&&ownerEmail&&assignedEmail!==ownerEmail)review.push('Source ownership identifiers conflict');
  const target=review.length?undefined:newByEmail.get(assignedEmail??ownerEmail??'');
  if((ownerId||assignedEmail)&&!target)review.push('Ownership needs review');
  if(target&&!target.active)review.push('Assigned recruiter login is not activated');
  const phoneRaw=str(r.phone_e164),phoneNormalized=normalizePhone(phoneRaw??'');if(!phoneNormalized)review.push('Invalid phone');
  const status=str(r.lead_status)??'unknown',blocked=r.contact_blocked===1||r.contact_blocked===true||status==='do_not_contact'||r.last_call_outcome==='do_not_contact';
  const callbackAt=iso(r.follow_up_at);let mapped:Contact['status']='closed';
  if(blocked)mapped='do_not_contact';else if(status==='wrong_number')mapped='invalid_number';else if(['rejected','withdrawn','not_interested','hired','submitted','approved','start_planned','application_in_progress','documents','company_matched'].includes(status))review.push('Legacy disposition retained for review');else if(callbackAt)mapped='callback_due';else if(['new','no_answer','interested','other'].includes(status))mapped='available';else review.push('Legacy disposition retained for review');
  if(!phoneNormalized&&mapped!=='do_not_contact')mapped='invalid_number';
  const owner=ownerPhones.get(phoneNormalized),members=batchByDriver.get(id)??[];
  const firstName=reliableImportedName(r.first_name),lastName=reliableImportedName(r.last_name);
  if((str(r.first_name)&&!firstName)||(str(r.last_name)&&!lastName))review.push('Non-name text withheld from display; original fields preserved');
  const rawFields:Contact['rawFields']={...r,note:[str(r.notes),str(r.follow_up_note)].filter(Boolean).join('\n'),legacy_record_json:JSON.stringify(r),legacy_source_project:m.sourceProjectId,legacy_table:m.sourceProjectId===WORKBOOK_SOURCE?'Kontakti':id.startsWith('owner:')?'owner_operator_contacts':'driver_profiles',legacy_record_id:id,legacy_owner_operator:!!owner,legacy_owner_operator_record:owner?JSON.stringify(owner):null,legacy_batch_membership:JSON.stringify(members.map(member=>({item:member,batch:m.contact_batches.find(b=>b.id===member.batch_id)??null}))),legacy_review:review.join('; ')};
  return {contact:{id:'legacy:'+id,firstName,lastName,nameEvidence:firstName||lastName?'explicit_source':'unknown',phoneRaw,phoneNormalized,email:str(r.email),city:str(r.city),state:str(r.state),sourceLabel:str(r.source)??'Old TTI Recruiter',sourceRecordId:m.sourceProjectId+':'+id,status:mapped,ownerRecruiterId:target?.id??null,reservedBy:null,activeConversationId:null,callbackAt,rawFields,isDemo:false},sourceKey:id,recordJson:JSON.stringify(r),blocked:blocked?1:0,duplicate:0,batchId:str(r.assignment_batch_id)??str(members[0]?.batch_id),nextAction:str(r.next_step)??(blocked?'Do Not Contact':mapped==='closed'?'Review preserved legacy disposition':'Continue recruiter conversation'),review};
 });
 const grouped=new Map<string,MigrationItem[]>();for(const item of items){const phone=item.contact.phoneNormalized;if(phone)grouped.set(phone,[...(grouped.get(phone)??[]),item]);}
 for(const group of grouped.values())if(group.length>1)for(const item of group){item.duplicate=1;item.review.push('Ambiguous shared normalized phone');item.contact.rawFields.legacy_review=item.review.join('; ');if(group.some(x=>x.blocked)){item.blocked=1;item.contact.status='do_not_contact';}else item.contact.status='closed';}
 return {items,orphanOwnerContacts:orphans.length,ownerMemberships:m.owner_operator_contacts.length,batchMemberships:m.contact_batch_items.length};
}
export function prepareRecruiterStubs(m:Manifest,existing:RecruiterRow[]){const known=new Set(existing.map(r=>r.email.toLowerCase()));return m.recruiters.filter(r=>email(r.email)&&!known.has(email(r.email)!)).map(r=>{
 const id='legacy-recruiter:'+String(r.id),profile:Recruiter={id,fullName:str(r.display_name)??String(r.email),alias:str(r.recruiter_alias)??str(r.display_name)??'TTI Recruiting',contactEmail:email(r.email),callbackNumber:str(r.business_phone),referralUrl:str(r.referral_link),reportingTimeZone:'America/Chicago',isDemo:false};
 // Preserve ownership without copying old Site auth IDs or granting access.
 return {id,email:email(r.email)!,active:0,data_json:JSON.stringify(profile)};
});}
interface Plan {schemaVersion:1;sourceProjectId?:string;runId:string;createdBy:string;createdAt:string;revision:number;items:MigrationItem[];recruiters:RecruiterRow[];summary:Record<string,number>;conflicts:{sourceId:string;reason:string;destinationId?:string}[];manifestKey:string;backupKey:string}
const key=(id:string)=>{if(!/^[a-f0-9-]{36}$/.test(id))throw new ServiceError('Invalid migration run.');return 'contact-migrations/'+id;};
export async function prepareContactMigration(db:D1Database,bucket:R2Bucket,a:Actor,input:unknown){
 requireAdmin(a);const manifest=manifestSchema.parse(input);const ids=new Set<string>();for(const r of manifest.driver_profiles){if(!str(r.id)||ids.has(String(r.id)))throw new ServiceError('Source has missing or repeated driver IDs.');ids.add(String(r.id));}
 const revision=await currentRevision(db);
 const sourceIds=manifest.driver_profiles.map(r=>'legacy:'+String(r.id)).concat(manifest.owner_operator_contacts.map(r=>'legacy:owner:'+String(r.phone_e164)));
 const sourcePhones=manifest.driver_profiles.concat(manifest.owner_operator_contacts).map(r=>normalizePhone(String(r.phone_e164??''))).filter(Boolean);
 // Snapshot precisely the destination rows this segment can affect. Bounded
 // segments keep large contact catalogs within D1 response limits.
 const [drivers,recruiters]=await Promise.all([db.prepare('SELECT * FROM drivers WHERE id IN (SELECT value FROM json_each(?)) OR phone IN (SELECT value FROM json_each(?)) ORDER BY id').bind(JSON.stringify(sourceIds),JSON.stringify(sourcePhones)).all<DriverRow>(),db.prepare('SELECT * FROM recruiters ORDER BY id').all<RecruiterRow>()]);
 const stubs=prepareRecruiterStubs(manifest,recruiters.results),mapped=mapLegacyContacts(manifest,[...recruiters.results,...stubs]);const conflicts:Plan['conflicts']=(manifest.review?.records??[]).map(r=>({sourceId:String(r.sourceId??r.row??'CSV'),reason:String(r.reason??'Import review')}));
 const byId=new Map(drivers.results.map(d=>[d.id,d])),byPhone=new Map(drivers.results.filter(d=>d.phone).map(d=>[d.phone!,d]));let matched=0;const inserts:MigrationItem[]=[];
 for(const item of mapped.items){const prior=byId.get(item.contact.id);if(prior){const contact=JSON.parse(prior.data_json) as Contact;if(contact.sourceRecordId!==item.contact.sourceRecordId||contact.rawFields.legacy_record_json!==item.recordJson)conflicts.push({sourceId:item.sourceKey,destinationId:prior.id,reason:'Source changed or destination provenance differs; destination left unchanged'});matched++;continue;}
  const collision=item.contact.phoneNormalized?byPhone.get(item.contact.phoneNormalized):undefined;
  if(collision&&manifest.sourceProjectId===WORKBOOK_SOURCE){matched++;conflicts.push({sourceId:item.sourceKey,destinationId:collision.id,reason:'Workbook phone already exists; duplicate skipped and existing data preserved'});continue;}
  if(collision){item.duplicate=1;if(!item.blocked)item.contact.status='closed';item.review.push('Destination phone collision; separate record quarantined');item.contact.rawFields.legacy_review=item.review.join('; ');conflicts.push({sourceId:item.sourceKey,destinationId:collision.id,reason:'Shared phone; no automatic merge'});}
  for(const reason of item.review)conflicts.push({sourceId:item.sourceKey,reason});inserts.push(item);
 }
 const runId=crypto.randomUUID(),prefix=key(runId),createdAt=new Date().toISOString();if(await currentRevision(db)!==revision)throw new ServiceError('Destination changed while preparing the snapshot. Retry the dry run.',409,'conflict');
 const summary={...manifest.review?.summary,sourceContacts:mapped.items.length,driverProfiles:manifest.driver_profiles.length,ownerMemberships:mapped.ownerMemberships,orphanOwnerContacts:mapped.orphanOwnerContacts,batchMemberships:mapped.batchMemberships,batches:manifest.contact_batches.length,expectedImports:inserts.length,matched,skipped:0,failed:0,unresolvedOwnership:mapped.items.filter(i=>!i.contact.ownerRecruiterId).length,inactiveRecruiterOwnership:mapped.items.filter(i=>i.review.includes('Assigned recruiter login is not activated')).length,restricted:mapped.items.filter(i=>i.blocked).length,duplicates:inserts.filter(i=>i.duplicate).length,conflicts:conflicts.length};
 const plan:Plan={schemaVersion:1,sourceProjectId:manifest.sourceProjectId,runId,createdBy:a.id,createdAt,revision,items:inserts,recruiters:stubs,summary,conflicts,manifestKey:prefix+'/source.json',backupKey:prefix+'/backup.json'};
 // Private R2 objects are written and read back before any D1 business writes.
 await bucket.put(plan.backupKey,JSON.stringify({schemaVersion:1,createdAt,revision,drivers:drivers.results,recruiters:recruiters.results}),{httpMetadata:{contentType:'application/json'}});
 await bucket.put(plan.manifestKey,JSON.stringify(manifest),{httpMetadata:{contentType:'application/json'}});await bucket.put(prefix+'/plan.json',JSON.stringify(plan),{httpMetadata:{contentType:'application/json'}});
 if(!(await bucket.head(plan.backupKey)))throw new ServiceError('Recoverable backup could not be verified. Nothing was imported.',503,'storage_failed');
 return {runId,summary,backupSaved:true,complete:inserts.length===0};
}
async function readPlan(bucket:R2Bucket,runId:string){const obj=await bucket.get(key(runId)+'/plan.json');if(!obj)throw new ServiceError('Migration run not found.',404,'not_found');return await obj.json<Plan>();}
export async function commitContactMigration(db:D1Database,bucket:R2Bucket,a:Actor,runId:string,cursor:number){
 requireAdmin(a);const plan=await readPlan(bucket,runId);if(!Number.isInteger(cursor)||cursor<0||cursor>plan.items.length||cursor%50!==0)throw new ServiceError('Invalid migration cursor.');
 const receiptId='contact-migration:'+runId+':'+cursor,prior=await db.prepare('SELECT data_json FROM mutation_receipts WHERE id=?').bind(receiptId).first<{data_json:string}>();if(prior)return JSON.parse(prior.data_json);
 if(cursor&&!(await db.prepare('SELECT id FROM mutation_receipts WHERE id=?').bind('contact-migration:'+runId+':'+(cursor-50)).first()))throw new ServiceError('Commit the previous migration batch first.',409,'conflict');
 const revision=await currentRevision(db);if(!cursor&&revision!==plan.revision)throw new ServiceError('Destination changed after the dry run. Prepare a new run.',409,'conflict');
 if(!(await bucket.head(plan.backupKey)))throw new ServiceError('Backup is unavailable. Import stopped.',503,'storage_failed');
 const statements:D1PreparedStatement[]=[];if(!cursor)for(const r of plan.recruiters)statements.push(db.prepare("INSERT INTO recruiters(id,user_id,email,role,active,data_json) VALUES(?,NULL,?,'recruiter',0,?)").bind(r.id,r.email,r.data_json));
 const batch=plan.items.slice(cursor,cursor+50);
 for(const item of batch){const c=item.contact;
  statements.push(db.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,batch_id,next_action,data_json) VALUES(?,?,?,?,?,?,?,?)').bind(c.id,c.ownerRecruiterId??null,item.duplicate?null:c.phoneNormalized,item.blocked,item.duplicate,item.batchId,item.nextAction,JSON.stringify(c)));
  // An imported restricted number also quarantines a pre-existing shared-phone
  // record. Identity, notes and newer edits are retained in the backup and row.
  if(item.duplicate&&item.blocked&&c.phoneNormalized)statements.push(db.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact'),next_action='Do Not Contact: shared source phone restriction requires owner review' WHERE phone=?").bind(c.phoneNormalized));
 }
 const next=cursor+batch.length,value={runId,imported:next,matched:plan.summary.matched,failed:0,nextCursor:next,complete:next>=plan.items.length,summary:plan.summary};
 statements.push(db.prepare('INSERT INTO audit(id,actor_id,driver_id,type,at,data_json) VALUES(?,?,NULL,?,?,?)').bind('contact-migration:'+runId+':'+cursor,a.id,'contact_migration',Date.now(),JSON.stringify({runId,sourceProjectId:plan.sourceProjectId??LEGACY_SOURCE,cursor,imported:batch.length,backupKey:plan.backupKey,noExternalActions:true})));
 statements.push(db.prepare('INSERT INTO mutation_receipts(id,actor_id,fingerprint,data_json) VALUES(?,?,?,?)').bind(receiptId,a.id,receiptId,JSON.stringify(value)));await guardedBatch(db,revision,statements);return value;
}
export async function verifyContactMigration(db:D1Database,bucket:R2Bucket,a:Actor,runId:string){
 requireAdmin(a);const plan=await readPlan(bucket,runId);const rows=await db.prepare('SELECT id,blocked,owner_id,data_json FROM drivers WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(plan.items.map(i=>i.contact.id))).all<DriverRow>();const indexed=new Map(rows.results.map(r=>[r.id,r]));
 let verified=0,missing=0,mismatched=0;for(const item of plan.items){const row=indexed.get(item.contact.id);if(!row){missing++;continue;}const c=JSON.parse(row.data_json) as Contact;if(c.rawFields.legacy_record_json===item.recordJson&&c.sourceRecordId===item.contact.sourceRecordId&&row.owner_id===(item.contact.ownerRecruiterId??null)&&(!item.blocked||row.blocked===1&&c.status==='do_not_contact'))verified++;else mismatched++;}
 const count=await db.prepare("SELECT COUNT(*) AS n FROM drivers WHERE json_extract(data_json,'$.rawFields.legacy_source_project') IN (?,?)").bind(LEGACY_SOURCE,WORKBOOK_SOURCE).first<{n:number}>();
 return {runId,summary:plan.summary,verified,missing,mismatched,storedSourceContacts:count?.n??0,complete:missing===0&&mismatched===0,backupSaved:!!(await bucket.head(plan.backupKey)),conflictCount:plan.conflicts.length};
}
export async function migrationReview(bucket:R2Bucket,a:Actor,runId:string,kind:'backup'|'conflicts'){requireAdmin(a);const plan=await readPlan(bucket,runId);if(kind==='conflicts')return new Response(JSON.stringify(plan.conflicts),{headers:{'content-type':'application/json','cache-control':'private, no-store'}});const object=await bucket.get(plan.backupKey);if(!object)throw new ServiceError('Backup not available.');return new Response(object.body,{headers:{'content-type':'application/json','content-disposition':'attachment; filename="tti-contact-migration-backup.json"','cache-control':'private, no-store','x-content-type-options':'nosniff'}});}

import type {Contact,Conversation} from '../contracts/index.ts';
import {currentRevision,guardedBatch} from './store.ts';
// Exact correction authorized by the account holder in this conversation.
// Server-only; no caller-controlled write, duplicate creation or external actions.
const phone='+16107186412',driverId='legacy:workbook-phone-e6a3c21750f143e6847b912c',email='cvetanovicaleksa45@gmail.com';
export const contactNameCorrectionMarker='requested-contact-name-correction:20261005-jordan';
export async function applyRequestedContactNameCorrection(db:D1Database){
 const row=await db.prepare('SELECT d.* FROM drivers d JOIN recruiters r ON r.id=d.owner_id WHERE d.id=? AND d.phone=? AND lower(trim(r.email))=?').bind(driverId,phone,email).first<{id:string;owner_id:string;data_json:string}>();
 if(!row)return {verified:false,applied:false};
 const prior=await db.prepare('SELECT id FROM audit WHERE id=?').bind(contactNameCorrectionMarker).first();
 const contact=JSON.parse(row.data_json) as Contact;
 if(prior)return {verified:contact.firstName==='Jordan'&&contact.lastName==='Christman',applied:false};
 const conversations=await db.prepare("SELECT id,data_json FROM conversations WHERE driver_id=? AND status IN ('active','paused')").bind(driverId).all<{id:string;data_json:string}>();
 const oldName=[contact.firstName,contact.lastName].filter(Boolean).join(' '),oldFirst=contact.firstName,now=Date.now();
 const revision=await currentRevision(db),statements:D1PreparedStatement[]=[];
 contact.firstName='Jordan';contact.lastName='Christman';contact.nameEvidence='explicit_source';
 contact.rawFields={...contact.rawFields,originalRecordedName:contact.rawFields.originalRecordedName??oldName,ownerConfirmedNameCorrection:contactNameCorrectionMarker};
 // Preserve history. Only a live opener's stale preferred name follows this explicit correction.
 for(const c of conversations.results){const v=JSON.parse(c.data_json) as Conversation;if(v.answers.preferredName&&[oldName,oldFirst].some(n=>n&&n.toLowerCase()===v.answers.preferredName!.toLowerCase())){v.answers.preferredName='Jordan Christman';v.revision+=1;v.updatedAt=new Date(now).toISOString();statements.push(db.prepare('UPDATE conversations SET data_json=? WHERE id=? AND data_json=?').bind(JSON.stringify(v),c.id,c.data_json));}}
 statements.push(db.prepare('UPDATE drivers SET data_json=? WHERE id=? AND owner_id=? AND phone=?').bind(JSON.stringify(contact),driverId,row.owner_id,phone),db.prepare("INSERT INTO audit(id,actor_id,driver_id,type,at,data_json) VALUES(?,?,?,'owner_confirmed_contact_name_correction',?,?)").bind(contactNameCorrectionMarker,row.owner_id,driverId,now,JSON.stringify({beforeDriver:row,beforeActiveConversations:conversations.results,evidence:'Account holder explicitly confirmed phone belongs to Jordan Christman on 2026-10-05',noExternalActions:true})));
 await guardedBatch(db,revision,statements);
 const saved=await db.prepare("SELECT json_extract(data_json,'$.firstName') AS first_name,json_extract(data_json,'$.lastName') AS last_name FROM drivers WHERE id=? AND phone=?").bind(driverId,phone).first<{first_name:string;last_name:string}>();
 return {verified:saved?.first_name==='Jordan'&&saved?.last_name==='Christman',applied:true};
}

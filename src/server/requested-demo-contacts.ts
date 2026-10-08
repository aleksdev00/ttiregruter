import type {Contact} from '../contracts/index.ts';
import {ServiceError,type Actor} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';

const recipientEmail='cvetanovicaleksa45@gmail.com';
const batchId='alex-extra-ten-20261004';
export const requestedDemoScenarios=[
 ['Robert','Miller','Company 1099; IL; 8 years; no SAP; dry van; OTR; 28 days out; starts next week.'],
 ['James','Wilson','Company 1099; IL; 3 years; completed SAP / RTD; dry van; OTR. Verify No SAP carriers disappear.'],
 ['Michael','Carter','Company 1099; IL; 5 years; needs RTD; reefer. Verify completed-only SAP carriers are excluded.'],
 ['David','Brooks','Company W-2; local preference. Verify the external application handoff and no duplicate questionnaire.'],
 ['Daniel','Reed','Lease; TX; 6 years; no SAP; reefer; OTR; 28 days out. Verify lease-specific FAQ.'],
 ['William','Turner','Owner-operator; GA; 10 years; no SAP; power only. Verify program-specific carrier conditions.'],
 ['Thomas','Hayes','Company 1099; IL; 2 years; no SAP; flatbed. Ask for separately verified flatbed experience.'],
 ['Christopher','Bennett','No answer. Open the complete voicemail script and record the actual outcome.'],
 ['Anthony','Parker','Interested but busy. Record an agreed callback time and verify the follow-up queue.'],
 ['Joseph','Morgan','Not interested, then requests Do Not Contact. Stop persuasion and preserve the restriction.'],
] as const;

// A one-time, owner-requested batch; only the verified recipient's own session
// can apply it. No public import endpoint, external messages or fixture fallback.
export async function applyRequestedAlexDemoContacts(db:D1Database,a:Actor){
 if(await db.prepare("SELECT id FROM audit WHERE id IN ('requested-demo-removal:alex:20261005','requested-demo-removal:all:20261005')").first())return {created:0};
 if(a.email.trim().toLowerCase()!==recipientEmail)return {created:0};
 const recipient=await db.prepare('SELECT id FROM recruiters WHERE lower(trim(email))=? AND active=1').bind(recipientEmail).first<{id:string}>();
 if(!recipient||recipient.id!==a.id)return {created:0};
 const marker=`requested-demo:${batchId}:${a.id}`;
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(marker).first())return {created:0};
 const revision=await currentRevision(db);
 const occupied=new Set((await db.prepare("SELECT phone FROM drivers WHERE phone LIKE '+120255501%'").all<{phone:string}>()).results.map(r=>r.phone));
 let suffix=100,created=0;
 const statements:D1PreparedStatement[]=[];
 for(const [index,[first,last,scenario]] of requestedDemoScenarios.entries()){
  const id=`000-demo:${batchId}:${String(index+1).padStart(2,'0')}`;
  if(await db.prepare('SELECT id FROM drivers WHERE id=?').bind(id).first())continue;
  while(suffix<=199&&occupied.has(`+1202555${String(suffix).padStart(4,'0')}`))suffix++;
  if(suffix>199)throw new ServiceError('Reserved demo phone range is full. No demo contacts were added.',409,'conflict');
  const phone=`+1202555${String(suffix++).padStart(4,'0')}`;occupied.add(phone);
  const contact:Contact={id,firstName:`Demo ${first}`,lastName:last,nameEvidence:'explicit_source',phoneRaw:phone,phoneNormalized:phone,email:null,city:null,state:null,sourceLabel:'DEMO — fictional practice driver',sourceRecordId:id,status:'available',ownerRecruiterId:a.id,reservedBy:null,activeConversationId:null,callbackAt:null,isDemo:true,rawFields:{demo_contact:true,demo_batch:batchId,demo_scenario:scenario,note:`DEMO ONLY — fictional practice contact. ${scenario}`,created_at:new Date().toISOString()}};
  statements.push(db.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,0,0,?,?)').bind(id,a.id,phone,`DEMO ONLY — ${scenario}`,JSON.stringify(contact)));created++;
 }
 statements.push(db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'requested_demo_contacts_added',?,?)").bind(marker,a.id,Date.now(),JSON.stringify({batchId,ownerRecruiterId:a.id,created,expectedTotal:10,noExternalActions:true})));
 await guardedBatch(db,revision,statements);
 return {created};
}

// Historical synthetic in-memory test fixtures. Never imported by the application.
import type {Contact} from '../../src/contracts/index.ts';
import {currentRevision,guardedBatch} from '../../src/server/store.ts';
import {requestedDemoScenarios} from './requested-demo-contacts.ts';
import {alexLaptopRemovalMarker} from '../../src/server/requested-demo-removal.ts';
// New explicit request supersedes removal only for this verified account.
// Old archived contacts, restrictions and all other accounts remain untouched.
const email='cvetanovicaleksa45@gmail.com';
const batchId='alex-laptop-ten-20261005';
const marker='requested-demo:'+batchId;
export async function applyRequestedLaptopDemoContacts(db:D1Database){
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(alexLaptopRemovalMarker).first())return {created:0,total:0};
 const accounts=await db.prepare('SELECT id FROM recruiters WHERE lower(trim(email))=? AND active=1').bind(email).all<{id:string}>();
 if(accounts.results.length!==1)return {created:0,total:0};
 const owner=accounts.results[0].id;
 const total=async()=>{const row=await db.prepare("SELECT COUNT(*) AS n FROM drivers WHERE owner_id=? AND json_extract(data_json,'$.rawFields.demo_batch')=? AND json_extract(data_json,'$.rawFields.demoRemovedAt') IS NULL").bind(owner,batchId).first<{n:number}>();return row?.n??0;};
 const prior=await db.prepare('SELECT data_json FROM audit WHERE id=?').bind(marker).first<{data_json:string}>();
 if(prior)return {created:JSON.parse(prior.data_json).created as number,total:await total()};
 const revision=await currentRevision(db),now=Date.now();
 const occupied=new Set((await db.prepare("SELECT phone FROM drivers WHERE phone LIKE '+120255501%' OR phone LIKE '+131255501%'").all<{phone:string}>()).results.map(row=>row.phone));
 const pool=['202','312'].flatMap(area=>Array.from({length:100},(_,i)=>`+1${area}555${String(100+i).padStart(4,'0')}`)).filter(phone=>!occupied.has(phone));
 if(pool.length<10)throw new Error('Fictional phone range is full; no test contacts added.');
 const writes:D1PreparedStatement[]=requestedDemoScenarios.map(([first,last,scenario],i)=>{
 const id=`000-demo:${batchId}:${String(i+1).padStart(2,'0')}`,phone=pool[i];
 const c:Contact={id,firstName:`Demo ${first}`,lastName:last,nameEvidence:'explicit_source',phoneRaw:phone,phoneNormalized:phone,email:null,city:null,state:null,sourceLabel:'DEMO — fictional practice driver',sourceRecordId:id,status:'available',ownerRecruiterId:owner,reservedBy:null,activeConversationId:null,callbackAt:null,isDemo:true,rawFields:{demo_contact:true,demo_batch:batchId,demo_scenario:scenario,note:`DEMO ONLY — fictional practice contact. ${scenario}`,created_at:new Date(now).toISOString()}};
 return db.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,0,0,?,?)').bind(id,owner,phone,`DEMO ONLY — ${scenario}`,JSON.stringify(c));
 });
 writes.push(db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'requested_demo_contacts_added',?,?)").bind(marker,owner,now,JSON.stringify({created:10,batchId,ownerRecruiterId:owner,noExternalActions:true})));
 await guardedBatch(db,revision,writes);
 return {created:10,total:await total()};
}

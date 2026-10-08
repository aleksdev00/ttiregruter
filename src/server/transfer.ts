import type {Offer,Conversation} from '../contracts/index.ts';
import {matchConversationOffer} from '../domain/offerMatching.ts';
import {authorizeDriver,ServiceError,type Actor} from './access.ts';
import {verifiedHQUrl,legacyHQPayload,type HQProtocol} from './hq.ts';
export interface TransferConfig {enabled:boolean;url?:string;secret?:string;mappingVerified:boolean;protocol?:HQProtocol;notificationAuthorized?:boolean}
interface RemoteResult {ok?:boolean;hq?:{ok?:boolean;recordId?:string;rowNumber?:number};crm?:{ok?:boolean;recordId?:string};notification?:{status?:string};email?:{status?:string};error?:string}
export function normalizeHQResult(id:string,r:RemoteResult,protocol:HQProtocol):RemoteResult{
 if(protocol!=='legacy')return r;
 // Legacy HQ returns a row number. Its CRM must read back the exact same
 // application ID before we acknowledge the HQ write as confirmed.
 const correlated=r.crm?.ok===true&&r.crm.recordId===id;
 return {...r,hq:r.hq?.ok&&correlated&&Number.isInteger(r.hq.rowNumber)&&r.hq.rowNumber!>0?{...r.hq,recordId:id}:r.hq,notification:{status:r.email?.status??'unknown'}};
}
export function transferStatuses(previous:{hq:string;crm:string;notification:string},id:string,r:RemoteResult){const hq=r.hq?.ok===true&&r.hq.recordId===id?'synced':previous.hq==='synced'?'synced':'failed',crm=r.ok===true&&r.crm?.ok===true&&r.crm.recordId===id?'synced':previous.crm==='synced'?'synced':'failed';return {hq,crm,notification:r.notification?.status??previous.notification,synced:r.ok===true&&hq==='synced'&&crm==='synced'};}
export async function transfer(db:D1Database,a:Actor,id:string,config:TransferConfig,send:typeof fetch=fetch){
 const app=await db.prepare('SELECT a.*,d.owner_id,d.blocked FROM applications a JOIN drivers d ON d.id=a.driver_id WHERE a.id=?').bind(id).first<{id:string;owner_id:string|null;blocked:number;driver_id:string;hq:string;crm:string;notification:string;data_json:string;lease_token:string|null;lease_at:number|null}>();authorizeDriver(a,app,true);
 if(app!.hq==='synced'&&app!.crm==='synced')return {synced:true,hq:app!.hq,crm:app!.crm,notification:app!.notification,idempotent:true};
 if(config.protocol==='legacy'&&!config.notificationAuthorized)throw new ServiceError('The existing LiveHQ webhook also emails tticdlrecruiting@gmail.com. Delivery is blocked until that notification is explicitly authorized. The application remains saved locally.',503,'not_configured');
 if(!config.enabled||!config.mappingVerified||!config.url||!config.secret)throw new ServiceError('HQ/CRM transfer is disabled until spreadsheet mappings, credentials, backup, and activation are approved.',503,'not_configured');
 const snapshot=JSON.parse(app!.data_json);if(app!.hq!=='synced'){const current=await db.prepare('SELECT o.version,c.version AS company_version,c.status,o.data_json FROM offers o JOIN companies c ON c.id=o.company_id WHERE o.id=?').bind(snapshot.terms.id).first<{version:string;company_version:number;status:string;data_json:string}>();const offer=current?JSON.parse(current.data_json) as Offer:null;if(!current||current.status!=='active'||current.version!==snapshot.terms.snapshotVersion||current.company_version!==snapshot.companyVersion||!offer?.recruitingApproved||offer.approvalStatus!=='approved'||matchConversationOffer(offer,{answers:snapshot.answers,playbook:{guide:snapshot.guide}} as Conversation).state!=='match')throw new ServiceError('Carrier terms changed or require verification. Review the saved application before transfer.',409,'conflict');}
 const conversation=await db.prepare('SELECT c.data_json FROM conversations c JOIN applications a ON a.conversation_id=c.id WHERE a.id=?').bind(id).first<{data_json:string}>();
 const currentConversation=conversation?JSON.parse(conversation.data_json) as Conversation:null;
 if(!currentConversation||currentConversation.selectedOfferId!==snapshot.terms.id||JSON.stringify(currentConversation.answers)!==JSON.stringify(snapshot.answers)||currentConversation.playbook?.flow?.applicationIntent!=='agreed')throw new ServiceError('Driver answers or company agreement changed after this application was saved. Review and explicitly submit the current selection; the earlier application has been preserved.',409,'conflict');
 verifiedHQUrl(config.url);
 const token=crypto.randomUUID(),now=Date.now();const lock=await db.prepare('UPDATE applications SET lease_token=?,lease_at=? WHERE id=? AND (lease_token IS NULL OR lease_at<?) AND EXISTS(SELECT 1 FROM drivers d WHERE d.id=applications.driver_id AND d.blocked=0 AND (?=1 OR d.owner_id=?))').bind(token,now,id,now-120000,a.role==='owner'||a.role==='admin'?1:0,a.id).run();if(!lock.meta.changes)return {processing:true};
 const attempt=crypto.randomUUID();await db.prepare('INSERT INTO integration_attempts(id,application_id,at,data_json) VALUES(?,?,?,?)').bind(attempt,id,now,JSON.stringify({status:'processing'})).run();
 const data=JSON.parse(app!.data_json),protocol=config.protocol??'mapped_bridge';const payload=protocol==='legacy'?legacyHQPayload(id,app!.driver_id,data,config.secret):{applicationId:id,driverId:app!.driver_id,driver:data.driver,recruiter:data.recruiter,offer:data.terms,stage:'internally_finalized',termsVersion:data.terms.snapshotVersion,secret:config.secret};let result:RemoteResult={},message:string|null=null;
 try{const response=await send(config.url,{method:'POST',headers:{'content-type':'application/json','idempotency-key':id},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});const remote=await response.json() as RemoteResult;if(response.ok)result=normalizeHQResult(id,remote,protocol);else message='Transfer response not confirmed. Retry the same application ID.';}catch{message='Transfer response was lost or invalid. Retry checks the same application ID.';}
 const status=transferStatuses(app!,id,result);if(!status.synced)message=message??'HQ and CRM have not both confirmed this Application ID.';
 await db.batch([db.prepare('UPDATE applications SET hq=?,crm=?,notification=?,lease_token=NULL,lease_at=NULL WHERE id=? AND lease_token=?').bind(status.hq,status.crm,status.notification,id,token),db.prepare('UPDATE integration_attempts SET data_json=? WHERE id=?').bind(JSON.stringify({...status,message,finishedAt:Date.now()}),attempt)]);
 return {...status,message,applicationId:id};
}

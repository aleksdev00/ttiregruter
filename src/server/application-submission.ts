import {operation} from './operations.ts';
import {authorizeDriver,ServiceError,type Actor} from './access.ts';
import {checkHQConnection} from './hq.ts';
import {transfer,type TransferConfig} from './transfer.ts';
import {persistInternalRouting} from './team-routing.ts';
export interface SubmissionConfig extends TransferConfig {notificationAuthorized?:boolean}
export async function applicationDelivery(db:D1Database,a:Actor,conversationId:string,offerId?:string){
 const driver=await db.prepare('SELECT d.owner_id,d.blocked FROM conversations c JOIN drivers d ON d.id=c.driver_id WHERE c.id=?').bind(conversationId).first<{owner_id:string|null;blocked:number}>();authorizeDriver(a,driver);
 const row=await db.prepare('SELECT id,hq,crm,notification,lease_token,lease_at,data_json FROM applications WHERE conversation_id=? AND (CAST(? AS TEXT) IS NULL OR offer_id=?) ORDER BY json_extract(data_json,\'$.createdAt\') DESC,id DESC LIMIT 1').bind(conversationId,offerId??null,offerId??null).first<{id:string;hq:string;crm:string;notification:string;lease_token:string|null;lease_at:number|null;data_json:string}>();
 if(!row)return null;
 const last=await db.prepare('SELECT data_json FROM integration_attempts WHERE application_id=? ORDER BY at DESC LIMIT 1').bind(row.id).first<{data_json:string}>();
 return {applicationId:row.id,state:row.hq==='synced'&&row.crm==='synced'?'delivered':row.lease_token&&row.lease_at&&row.lease_at>Date.now()-120000?'pending':row.hq==='failed'||row.crm==='failed'?'failed':'saved_locally',company:JSON.parse(row.data_json).terms.companyName,notification:row.notification,message:last?JSON.parse(last.data_json).message??null:null};
}
export async function submitApplication(db:D1Database,a:Actor,input:{conversationId:string;offerVersion:string;requestId:string},config:SubmissionConfig,send:typeof fetch=fetch){
 // Finalization is a separate durable write. No progress/outcome operation calls this.
 const saved=await operation(db,a,'finalize_internal',input) as {applicationId:string};
 await persistInternalRouting(db,a,saved.applicationId);
 try{
  if(!config.enabled)throw new ServiceError('LiveHQ delivery is disabled. The application is saved locally.',503,'not_configured');
  const check=await checkHQConnection(config,send);
  if(!check.connected||!check.protocol||check.protocol!==(config.protocol??'mapped_bridge'))throw new ServiceError('LiveHQ connection or protocol is not verified. Check HQ connection in Integrations.',503,'not_configured');
  await transfer(db,a,saved.applicationId,{...config,mappingVerified:check.protocol==='legacy'||config.mappingVerified},send);
 }catch(error){
  const message=error instanceof ServiceError?error.message:'LiveHQ did not confirm delivery. Retry the same saved application.';
  await db.batch([db.prepare("UPDATE applications SET hq=CASE WHEN hq='synced' THEN hq ELSE 'failed' END,crm=CASE WHEN crm='synced' THEN crm ELSE 'failed' END WHERE id=? AND lease_token IS NULL").bind(saved.applicationId),db.prepare('INSERT INTO integration_attempts(id,application_id,at,data_json) VALUES(?,?,?,?)').bind(crypto.randomUUID(),saved.applicationId,Date.now(),JSON.stringify({status:'failed',message}))]);
 }
 return applicationDelivery(db,a,input.conversationId,(await db.prepare('SELECT offer_id FROM applications WHERE id=?').bind(saved.applicationId).first<{offer_id:string}>())?.offer_id);
}

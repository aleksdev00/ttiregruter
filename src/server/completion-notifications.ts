import type {Actor} from './access.ts';
import {authorizeDriver,ServiceError} from './access.ts';
import type {Contact,Conversation,Offer} from '../contracts/index.ts';
import {verifiedHQUrl,type HQSettings} from './hq.ts';
export type NotificationStatus='pending'|'sending'|'sent'|'failed'|'unconfirmed'|'blocked';
export interface NotificationRow {id:string;conversation_id:string;payload_json:string;status:NotificationStatus;lease_token:string|null;lease_at:number|null;message:string;updated_at:number}
export function completionPayload(a:Actor,c:Conversation,d:Contact,o?:Offer){return {notificationId:'conversation:'+c.id,conversationId:c.id,completedAtUtc:c.closedAt,recruiter:{id:a.id,realName:a.profile.fullName||null,alias:a.profile.alias,verifiedEmail:a.email},driver:{id:d.id,recordedName:[d.firstName,d.lastName].filter(Boolean).join(' ')||null,phone:d.phoneRaw??d.phoneNormalized,email:d.email,recordedState:d.state},confirmedInformation:c.answers,qualification:c.playbook?.guide??null,notes:c.playbook?.notes??null,selectedCompany:o?{id:o.id,name:o.companyName,program:o.documentedTerms?.program??o.employment,approvalStatus:o.approvalStatus??'unknown',recruitingApproved:o.recruitingApproved===true,verifiedAt:o.verifiedAt,expiresAt:o.expiresAt,snapshotVersion:o.snapshotVersion}:c.selectedOfferId?{id:c.selectedOfferId,verificationStatus:'Unavailable — not verified'}:null,outcome:c.outcome,voicemailStatus:c.playbook?.flow?.voicemailStatus??'unknown',callbackAt:c.outcome==='callback'?d.callbackAt:null,callbackTimeZone:c.outcome==='callback'?c.playbook?.notes.dueTimeZone||d.rawFields.callbackTimeZone||null:null,applicationEvidence:c.playbook?.externalReceipt??null};}
export async function notificationRecord(db:D1Database,a:Actor,conversationId:string){
 const d=await db.prepare('SELECT d.owner_id,d.blocked FROM conversations c JOIN drivers d ON d.id=c.driver_id WHERE c.id=?').bind(conversationId).first<{owner_id:string|null;blocked:number}>();authorizeDriver(a,d);
 return db.prepare('SELECT * FROM completion_notifications WHERE conversation_id=?').bind(conversationId).first<NotificationRow>();
}
export function publicNotification(r:NotificationRow|null){return r?{id:r.id,conversationId:r.conversation_id,status:r.status,message:r.message,updatedAt:r.updated_at}:null;}
async function update(db:D1Database,r:NotificationRow,token:string,status:NotificationStatus,message:string){await db.prepare('UPDATE completion_notifications SET status=?,message=?,updated_at=?,lease_token=NULL,lease_at=NULL WHERE id=? AND lease_token=?').bind(status,message,Date.now(),r.id,token).run();}
// A send lease is never expired into another send. A lost acknowledgement is reconciled by status only.
export async function deliverCompletion(db:D1Database,a:Actor,conversationId:string,settings:HQSettings,operation:'retry'|'check'='retry',send:typeof fetch=fetch){
 let r=await notificationRecord(db,a,conversationId);if(!r||r.status==='sent')return publicNotification(r);
 if(r.status==='sending'&&r.lease_at&&Date.now()-r.lease_at<60000)return publicNotification(r);
 const reconcile=r.status==='unconfirmed'||r.status==='sending'||operation==='check';
 const token=crypto.randomUUID();const claim=await db.prepare('UPDATE completion_notifications SET status=?,lease_token=?,lease_at=?,updated_at=? WHERE id=? AND status=? AND (lease_token IS NULL OR lease_at<?)').bind('sending',token,Date.now(),Date.now(),r.id,r.status,Date.now()-60000).run();
 if(claim.meta.changes!==1)return publicNotification(await notificationRecord(db,a,conversationId));
 let attempted=false;
 try{
  if(!verifiedHQUrl(settings.url)||!settings.secret){await update(db,r,token,reconcile?'unconfirmed':'blocked','Completion email integration is not configured. Conversation remains saved.');return publicNotification(await notificationRecord(db,a,conversationId));}
  const post=async(body:object)=>{const response=await send(settings.url!,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,webhookSecret:settings.secret}),signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('Webhook did not confirm the result.');return await response.json() as Record<string,any>;};
  const capability=await post({action:'conversationCompletionCapabilities'});
  if(capability.ok!==true||capability.conversationCompletion?.version!==1){await update(db,r,token,reconcile?'unconfirmed':'blocked','Owner must deploy the dedicated conversation-completion Apps Script action. No completion email was sent by this attempt.');}
  else{
   attempted=!reconcile;
   const response=await post({action:reconcile?'conversationCompletionStatus':'completeConversation',notificationId:r.id,...(!reconcile?{completion:JSON.parse(r.payload_json)}:{})});
   const email=response.email;
   if(response.ok===true&&response.notificationId===r.id&&email?.ok===true&&email.status==='sent')await update(db,r,token,'sent','Webhook confirmed email sent to tticdlrecruiting@gmail.com. Inbox receipt has not been independently verified.');
   else if(response.notificationId===r.id&&email?.ok===false&&email.status==='failed'&&email.safeToRetry===true)await update(db,r,token,'failed','Email was not sent. Retry is available using the same notification ID.');
   else if(reconcile&&response.ok===true&&response.notificationId===r.id&&email?.status==='not_found'&&email.safeToRetry===true)await update(db,r,token,'failed','Webhook confirms no send was recorded. Retry with the same notification ID.');
   else await update(db,r,token,'unconfirmed','Email delivery is unconfirmed. Check status; do not resend until the receiver confirms no send occurred.');
  }
 }catch{await update(db,r,token,reconcile||attempted?'unconfirmed':'blocked',reconcile||attempted?'Delivery unconfirmed. Check status to reconcile the same notification; automatic resending is disabled.':'Could not verify the completion integration. No send attempted. Retry connection after the owner deploys the action.');}
 return publicNotification(await notificationRecord(db,a,conversationId));
}

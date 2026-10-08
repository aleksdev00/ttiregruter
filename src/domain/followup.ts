export const proposedFollowUp={enabled:false,timeZone:'America/Chicago',healthReview:{schedule:'0 8 * * 1-5',description:'Weekday 8:00 AM review of failed transfers, unassigned leads, conflicting statuses and integration health. No outbound communication.'},retentionDays:[3,7,30,45,60,90],freshInboundTargetMinutes:5};
export function responseTiming(receivedAt:string,firstAttemptAt:string|null){const received=Date.parse(receivedAt),attempt=firstAttemptAt?Date.parse(firstAttemptAt):null;if(!Number.isFinite(received))return {status:'needs_review',minutes:null};return {status:attempt===null?'not_attempted':attempt<received?'needs_review':'attempted',minutes:attempt===null?null:Math.max(0,(attempt-received)/60000)};}
import type {Conversation} from '../contracts/index.ts';
const nextActions:Record<string,string>={
 interested:'Confirm the driver’s next step and agree on follow-up.',
 qualification_in_progress:'Complete the remaining driver qualification details.',
 pending_verification:'Verify the outstanding facts before proceeding.',
 company_chosen:'Confirm the selected company and remaining application details.',
 handoff_required:'Complete the agreed handoff and confirm its result.',
 no_current_fit:'Review suitable opportunities and agree on follow-up.'
};
export function conversationFollowup(c:Conversation){
 const callback=c.status==='closed'&&c.outcome==='callback';
 const incomplete=c.status==='closed'&&c.outcome?nextActions[c.outcome]:undefined;
 const due=callback?c.playbook?.flow?.outcomeDraft.callbackAt:c.playbook?.notes.dueAt;
 if(!callback&&!incomplete&&!due)return null;
 return {kind:callback?'callback':incomplete?'application_followup':'agreed_followup',dueAt:due&&Number.isFinite(Date.parse(due))?Date.parse(due):null,data:{...c.playbook?.notes,conversationId:c.id,outcome:c.outcome,nextAction:c.playbook?.notes.nextAction?.trim()||(callback?'Call the driver at the agreed callback time.':incomplete||'Review recorded follow-up')}};
}

import type {Conversation,AuditEvent,CallOutcome} from '../contracts/index.ts';
export const conversationStages=['opening','qualification','objection_selection','objection_response','voicemail','offer_comparison','application_next_step','outcome_review','finished'] as const;
export type ConversationStage=typeof conversationStages[number];
export type ConversationAction='report_callback'|'report_wrong_number'|'wrong_number'|'report_interested'|'report_not_interested'|'report_no_answer'|'interested'|'not_interested'|'no_answer'|'resume'|'change_reason'|'declined'|'do_not_contact'|'callback'|'voicemail_left'|'voicemail_unavailable'|'compare_offers'|'application_next'|'agree_to_apply'|'review_outcome'|'return_from_outcome'|'return_from_voicemail';
export interface ConversationFlow {objectionProbeUsed?:boolean;stage:ConversationStage;interrupted:{stage:ConversationStage;stepId:string}|null;objectionId:string|null;outcomeDraft:{outcome:CallOutcome|null;callbackAt:string|null};applicationIntent:'unknown'|'agreed';voicemailStatus:'unknown'|'reported_left'|'unavailable'}
export const emptyFlow:ConversationFlow={stage:'opening',interrupted:null,objectionId:null,outcomeDraft:{outcome:null,callbackAt:null},applicationIntent:'unknown',voicemailStatus:'unknown'};
export const objectionChoices=[{label:'Pay',scenarioId:'S019'},{label:'Home time',scenarioId:'S020'},{label:'Routes',scenarioId:'S076'},{label:'Equipment',scenarioId:'S081'},{label:'Already employed',scenarioId:'S017'},{label:'Trust / past recruiters',scenarioId:'S087'},{label:'Busy / unavailable',scenarioId:'S007'},{label:'Where did you get my number?',scenarioId:'S003'},{label:'Hesitation / needs time',scenarioId:'S106'},{label:'Send information',scenarioId:'S107'},{label:'Call later',scenarioId:'S009'},{label:'Something else',scenarioId:'S169'}];
export function conversationFlow(c:Conversation):ConversationFlow{
 if(c.playbook?.flow)return structuredClone(c.playbook.flow);
 const stage:ConversationStage=c.status==='closed'||c.status==='cancelled'?'finished':c.activeStepId==='opening'?'opening':c.activeStepId==='offer'?'offer_comparison':['application','w2_handoff'].includes(c.activeStepId)?'application_next_step':'qualification';
 return {...structuredClone(emptyFlow),stage};
}
export function callEvidence(c:Conversation,events:AuditEvent[]){return {started:events.some(e=>e.conversationId===c.id&&e.type==='call_attempt_started'),answered:events.some(e=>e.conversationId===c.id&&e.type==='call_connected'),finished:events.some(e=>e.conversationId===c.id&&e.type==='conversation_finished')};}
export function outcomeConsistency(c:Conversation,outcome:CallOutcome|null,events:AuditEvent[]):string|null{
 if(!outcome)return 'Choose an explicit call outcome.';const call=callEvidence(c,events);
 if(outcome==='do_not_contact')return null;
 if(!call.started)return 'Record the call attempt first, or cancel before calling.';
 if(outcome==='no_answer'&&call.answered)return 'No answer is inconsistent with the recorded answered call.';
 if(['interested','not_interested','no_current_fit','w2_routed','qualification_in_progress','company_chosen','application_started','application_received','driver_reports_applied'].includes(outcome)&&!call.answered)return 'Record that the driver answered before choosing this outcome.';
 return null;
}

export type ScenarioChannel = 'spoken' | 'voicemail' | 'text' | 'email' | 'operational';
export type PlaybookOutcome = 'no_current_fit'|'w2_routed'|'qualification_in_progress'|'company_chosen'|'application_started'|'application_received'|'pending_verification'|'handoff_required';
export interface CallNotes {
  incidents?:string; nonNegotiables:string; verifiedTermsDiscussed:string; unresolvedQuestion:string;
  contactPreferences:string; nextAction:string; owner:string; dueAt:string|null;
  dueTimeZone:string; channel:'unknown'|'call'|'text'|'email';
}
export interface PlaybookState {
  flow?:import('../domain/conversation.ts').ConversationFlow;
  guide?:import('../domain/guide.ts').GuideState;
  notes:CallNotes;
  last1099StepId:string|null;
  applicationStatus:'unknown'|'driver_reported'|'demo_confirmed'|'verified_received';
  externalReceipt?:{id:string;evidence:string;receivedAt:string;confirmedBy:string;source:string};
  communicationStatus:'not_prepared'|'draft_prepared'|'copied'|'manual_sent_reported'|'opened';
  communicationPermission:'unknown'|'allowed'|'declined';
}
export const emptyNotes:CallNotes={nonNegotiables:'',verifiedTermsDiscussed:'',unresolvedQuestion:'',contactPreferences:'',nextAction:'',owner:'',dueAt:null,dueTimeZone:'',channel:'unknown'};
export const emptyPlaybookState:PlaybookState={notes:emptyNotes,last1099StepId:null,applicationStatus:'unknown',communicationStatus:'not_prepared',communicationPermission:'unknown'};

import {conversationFlow} from './conversation.ts';
import {guideQuestions,guideQuestion,guideProgress,applicationGuideQuestions,validateGuideAnswer,nextGuideStep,guideState,internalPath} from './guide.ts';
import type { Conversation, Recruiter, DriverAnswers, Offer } from '../contracts/index.ts';
import type { CallNotes, PlaybookState } from '../contracts/playbook.ts';
import { emptyPlaybookState } from '../contracts/playbook.ts';

// Recovered from the previous recruiter source at the user's explicit request.
export const approved1099Questionnaire = {status:'recovered_previous_source',version:'0a5bfe719e4a1a6f460c5574a8b73534abbb5a6c',questions:guideQuestions} as const;
export const internalStepIds = [...guideQuestions.map(q=>`guide_${q.id}`),'state','license','experience','routes','home','start','qualification_blocked','offer','application'];
export const playbookOutcomes = ['no_answer','wrong_number','do_not_contact','callback','no_current_fit','w2_routed','qualification_in_progress','company_chosen','application_started','application_received','pending_verification','not_interested','handoff_required','interested','driver_reports_applied'] as const;
export function sessionPlaybook(c:Conversation):PlaybookState {return c.playbook??structuredClone(emptyPlaybookState);}
export function qualificationGate(c:Conversation) {
  if(c.answers.employment==='w2'&&!['lease','owner_operator'].includes(c.answers.position??''))return {required:false,complete:false,message:'W-2 bypasses the internal 1099 questionnaire.'};
  if(!internalPath(c))return {required:false,complete:false,message:'Confirm the position and employment path; missing details stay visible for review.'};
  const g=guideState(c),questions=applicationGuideQuestions(c),missing=questions.filter(q=>!g.confirmed[q.id]||!!g.reviewReasons[q.id]||validateGuideAnswer(q.id,g.answers[q.id]??'','')!==null);
  return {required:true,complete:missing.length===0,message:missing.length===0?'Call answers and location recorded. Carrier eligibility and offer terms still require verification.':`Before submitting, confirm: ${missing.map(q=>q.label).join(', ')}. Additional preferences are optional unless required by the selected carrier.`};
}
export function nextCallStep(c:Conversation):string {
  const sequence=['opening','guide_position'];const index=sequence.indexOf(c.activeStepId);
  if(conversationFlow(c).stage==='qualification'&&c.activeStepId==='opening')return nextGuideStep(c);
  if(index>=0&&index<sequence.length-1)return sequence[index+1];
  return c.answers.employment==='w2'&&!['lease','owner_operator'].includes(c.answers.position??'')?'w2_handoff':nextGuideStep(c);
}
export function routeChangedAnswers(c:Conversation,a:DriverAnswers,requestedStep:string) {
  const previous=sessionPlaybook(c),state=structuredClone(previous);let step=requestedStep;let clearSelection=false;
  if(a.position!==c.answers.position){clearSelection=true;state.communicationStatus='not_prepared';if(['lease','owner_operator'].includes(a.position??''))step=nextGuideStep({...c,answers:a,playbook:state});}
  if(a.employment!==c.answers.employment&&!['lease','owner_operator'].includes(a.position??'')) {
    if(c.answers.employment==='1099')state.last1099StepId=c.activeStepId;
    state.communicationStatus='not_prepared';
    if(a.employment==='w2'){step='w2_handoff';clearSelection=true;}
    else if(a.employment==='1099'){state.guide=guideState(c);state.guide.answers.employmentType='1099';state.guide.confirmed.employmentType=true;delete state.guide.reviewReasons.employmentType;step=state.last1099StepId&&internalStepIds.includes(state.last1099StepId)?state.last1099StepId:nextGuideStep({...c,answers:a,playbook:state});const restored=guideQuestion(step);if(restored&&state.guide.confirmed[restored.id])step=nextGuideStep({...c,answers:a,playbook:state});clearSelection=true;}
    else {step='employment';clearSelection=true;}
  }
  if(['name','B04','b04','guide_priority','guide_dealbreakers','priority','non_negotiables','dealbreakers'].includes(step))step=nextGuideStep({...c,answers:a,playbook:state});
  if(a.employment==='w2'&&!['lease','owner_operator'].includes(a.position??'')&&internalStepIds.includes(step)&&!['guide_position','guide_employmentType'].includes(step))step='w2_handoff';
  if(step==='employment'&&['lease','owner_operator'].includes(a.position??''))step=nextGuideStep({...c,answers:a,playbook:state});
  return {step,state,clearSelection};
}
export function referralReadiness(recruiter:Recruiter):{ready:boolean;url:string|null;message:string} {
  if(!recruiter.referralUrl)return {ready:false,url:null,message:'Referral link not configured. An approved recruiter-attributed link is required.'};
  try {const u=new URL(recruiter.referralUrl);if(u.protocol!=='https:'||u.hostname!=='apply.ttirecruiting.us'||u.username||u.password)throw new Error();
    if(u.pathname==='/'&&!u.search&&!u.hash)return {ready:false,url:null,message:'The generic application URL does not establish recruiter attribution.'};
    return {ready:true,url:recruiter.referralUrl,message:'Using the recruiter referral URL supplied by configuration; no parameters were generated.'};
  }catch{return {ready:false,url:null,message:'The configured link is not a valid approved W-2 application destination.'};}
}
export function validateNotes(notes:CallNotes):string|null {
  if(Object.entries(notes).some(([k,v])=>typeof v==='string'&&v.length>(['dueAt','dueTimeZone','channel'].includes(k)?100:400)))return 'Keep each note to 400 characters. Use the authorized system for sensitive documents.';
  if(notes.dueAt!==null&&!Number.isFinite(Date.parse(notes.dueAt)))return 'Enter a valid agreed response time.';
  if(notes.dueAt&&!notes.dueTimeZone.trim())return 'Record the time zone for the agreed response time.';
  if(notes.dueTimeZone){try{new Intl.DateTimeFormat('en-US',{timeZone:notes.dueTimeZone});}catch{return 'Use a valid time zone such as America/Chicago.';}}
  return null;
}
export function verifiedOffer(o:Offer|undefined):boolean {
  return !!o&&!o.isDemo&&o.source==='approved_snapshot'&&!!o.verifiedAt&&Number.isFinite(Date.parse(o.verifiedAt))&&Date.parse(o.verifiedAt)<=Date.now()&&o.active&&o.recruitingApproved!==false&&(!o.approvalStatus||o.approvalStatus==='approved')&&(!o.expiresAt||new Date(o.expiresAt)>new Date());
}

export function applicationDestination(_recruiter:Recruiter):{ready:boolean;url:string|null;message:string}{return {ready:false,url:null,message:'Private test: external application destinations are disabled.'};}

import data from '../content/playbook/previous-guide.json' with {type:'json'};
import type {Conversation,DriverAnswers} from '../contracts/index.ts';
import {callQuestionOrder,callQuestions} from '../content/playbook/concise.ts';
export const guideQuestions=data.questions.map(q=>({...q,spoken:callQuestions[q.id]??q.spoken})).sort((a,b)=>callQuestionOrder.indexOf(a.id)-callQuestionOrder.indexOf(b.id));
export const guideQuestion=(step:string)=>guideQuestions.find(q=>`guide_${q.id}`===step);
export interface GuideState {answers:Record<string,string>;confirmed:Record<string,boolean>;reviewReasons:Record<string,string>;lastAnswered:string|null;statuses?:Record<string,AnswerStatus>}
export type AnswerStatus='confirmed'|'driver_unknown'|'declined'|'awaiting_verification'|'not_applicable';
export const answerStatus=(g:GuideState,id:string):AnswerStatus|'unanswered'=>g.statuses?.[id]??(g.confirmed[id]?'confirmed':g.reviewReasons[id]?'driver_unknown':'unanswered');
export function activeGuideQuestions(c:Conversation){if(c.answers.employment==='w2'&&!['lease','owner_operator'].includes(c.answers.position??''))return guideQuestions.filter(q=>['position','employmentType'].includes(q.id));return ['lease','owner_operator'].includes(c.answers.position??'')?guideQuestions.filter(q=>q.id!=='employmentType'):guideQuestions;}
// Only this short sequence drives the live conversation. Keep the full bank for
// explicit reviews, carrier-specific requirements and application details.
export const recordOnlyIds=['priority','dealbreakers'] as const;
export const isRecordOnly=(id:string)=>recordOnlyIds.some(x=>x===id);
export const retiredInterviewStep=(step:string)=>['B04','b04','guide_priority','guide_dealbreakers','priority','non_negotiables','dealbreakers'].includes(step);
export const callQuestionIds=['position','employmentType','state','locationZip','route','home','trailer','experienceMonths','sap','availability'] as const;
// Preserve the approved submission gate; optional early preferences do not become prerequisites.
export const applicationQuestionIds=['position','employmentType','experienceMonths','sap','home','availability','trailer','state','locationZip'] as const;
export function callGuideQuestions(c:Conversation){return activeGuideQuestions(c).filter(q=>callQuestionIds.some(id=>id===q.id));}
export function applicationGuideQuestions(c:Conversation){return activeGuideQuestions(c).filter(q=>applicationQuestionIds.some(id=>id===q.id));}
export function callProgress(c:Conversation){const g=guideState(c),questions=callGuideQuestions(c);return {total:questions.length,confirmed:questions.filter(q=>g.confirmed[q.id]&&!g.reviewReasons[q.id]).length,next:questions.find(q=>!g.confirmed[q.id]&&!g.reviewReasons[q.id])?.id??null};}
export const internalPath=(c:Conversation)=>c.answers.employment==='1099'||['lease','owner_operator'].includes(c.answers.position??'');
export const externalApplicationPath=(c:Conversation)=>c.answers.employment==='w2'&&!internalPath(c);
export const emptyGuide:GuideState={answers:{},confirmed:{},reviewReasons:{},lastAnswered:null};
export function guideState(c:Conversation):GuideState{return structuredClone(c.playbook?.guide??emptyGuide);}
export function validateGuideAnswer(id:string,value:string,reason:string):string|null{
 const q=guideQuestions.find(q=>q.id===id);if(!q)return 'Unknown qualification question.';
 if(value.length>400||reason.length>400)return 'Keep each answer or review reason to 400 characters.';
 if(!value.trim())return reason.trim()||isRecordOnly(id)?null:'Confirm an answer or explain why it needs verification.';
 if(value.trim()&&value!=='unknown'&&reason.trim())return 'Record a confirmed answer or an unknown reason, not both.';
 if(value==='unknown'&&!reason.trim())return 'Record why this answer is unknown.';
 if(q.type==='select'&&!q.options.some(([v])=>v===value))return 'Choose one of the source question options.';
 if(q.type==='text'&&['unknown','n/a','na','not applicable'].includes(value.trim().toLowerCase())&&!reason.trim())return 'Choose an explicit unknown status and record a reason.';
 if(q.type==='number'&&(!/^\d+$/.test(value)||Number(value)>720))return 'Enter whole months from 0 to 720.';
 if(id==='locationZip'&&!/^[\p{L}][\p{L} .'-]{1,79}\s\|\s\d{5}(?:-\d{4})?$/u.test(value.trim()))return 'Enter a city and a valid 5-digit ZIP in the separate fields.';
 if(id==='payTarget'&&!/^\d+(?:\.\d{1,2})?\s\|\s(gross|take_home)\s\|\s(weekly|monthly|annual|hourly)$/.test(value.trim()))return 'Enter a nonnegative pay amount, gross or take-home basis, and pay period.';
 return null;
}
export function guideProgress(c:Conversation){const state=guideState(c),questions=activeGuideQuestions(c).filter(q=>!isRecordOnly(q.id)),handled=questions.filter(q=>state.confirmed[q.id]||state.reviewReasons[q.id]),verified=questions.filter(q=>state.confirmed[q.id]&&!state.reviewReasons[q.id]&&validateGuideAnswer(q.id,state.answers[q.id]??'','')===null);return {handled:handled.length,confirmed:verified.length,total:questions.length,complete:internalPath(c)&&verified.length===questions.length,next:questions.find(q=>!state.confirmed[q.id]&&!state.reviewReasons[q.id])?.id??null};}
export function nextGuideStep(c:Conversation){
 if(c.answers.employment==='w2'&&!['lease','owner_operator'].includes(c.answers.position??''))return 'w2_handoff';
 const g=guideState(c);if(!g.confirmed.position&&!g.reviewReasons.position)return 'guide_position';
 if(!['lease','owner_operator'].includes(c.answers.position??'')&&['either','unknown'].includes(c.answers.employment)&&!g.reviewReasons.employmentType)return 'guide_employmentType';
 const next=callProgress(c).next;
 if(next==='sap'&&g.confirmed.experienceMonths&&!c.playbook?.notes.incidents?.trim())return 'incidents';
 return next?`guide_${next}`:'offer';
}
export function projectGuideAnswer(a:DriverAnswers,id:string,value:string):DriverAnswers{
 const next={...a};if(id==='position'){next.position=({'Company driver':'company','Lease':'lease','Owner-operator':'owner_operator'} as const)[value as 'Company driver'|'Lease'|'Owner-operator']??'unknown';if(['lease','owner_operator'].includes(next.position))next.employment='unknown';}
 if(id==='employmentType')next.employment=value==='W-2'?'w2':value==='1099'?'1099':'either';
 if(id==='state')next.homeState=value||null;if(id==='experienceMonths')next.experienceMonths=value===''?null:Number(value);if(id==='experienceMonths')next.licenseClass=value===''||Number(value)===0?'unknown':'A';
 if(id==='route')next.routePreference=({OTR:'otr',Regional:'regional',Local:'local'} as const)[value as 'OTR'|'Regional'|'Local']??'unknown';
 if(id==='home')next.homeTimePreference=value==='1'?'daily':value==='7'?'weekly':'unknown';
 if(id==='dealbreakers')next.nonNegotiables=value||null;
 if(id==='priority')next.priority=value?'other':null;
 return next;
}
export function acknowledgment(c:Conversation){
 const state=guideState(c),id=state.lastAnswered;if(!id)return '';if(state.reviewReasons[id])return 'Understood—we’ll verify that. ';if(!state.confirmed[id])return '';return 'Got it. ';
}

// Home base and schedule are needed before a spoken company pitch. This does
// not change the submission gate or make all optional preferences compulsory.
export function presentationContextReady(c:Conversation){const g=guideState(c);return ['state','locationZip','home'].every(id=>g.confirmed[id]&&!g.reviewReasons[id]&&validateGuideAnswer(id,g.answers[id]??'','')===null)&&!!(g.confirmed.route||g.reviewReasons.route);}

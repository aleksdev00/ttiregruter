import type {Conversation} from '../contracts/index.ts';
import {guideQuestions,guideState,answerStatus} from './guide.ts';
export type SavedAnswerRow={id:string;label:string;value:string;status:string;reason:string|null};
const statuses:Record<string,string>={confirmed:'Confirmed',driver_unknown:'Driver does not know',declined:'Driver declined',awaiting_verification:'Needs verification',not_applicable:'Not applicable',unanswered:'Not answered'};
export function savedAnswerRows(c:Conversation):SavedAnswerRow[]{
 const g=guideState(c),a=c.answers;
 const legacy:Record<string,string|number|null|undefined>={position:a.position==='owner_operator'?'Owner-operator':a.position==='company'?'Company driver':a.position==='lease'?'Lease':null,employmentType:a.employment==='w2'?'W-2':a.employment==='1099'?'1099':a.employment==='either'?'Either':null,state:a.homeState,experienceMonths:a.experienceMonths,route:a.routePreference==='otr'?'OTR':a.routePreference==='regional'?'Regional':a.routePreference==='local'?'Local':a.routePreference==='any'?'Any route':null,home:a.homeTimePreference==='daily'?'Home daily':a.homeTimePreference==='weekly'?'Home weekly':a.homeTimePreference==='flexible'?'Flexible':null,availability:a.startWindow==='now'?'Available now':a.startWindow==='two_weeks'?'Available in two weeks':a.startWindow==='later'?'Later — date not recorded':null,priority:a.priority?({pay:'Pay',home_time:'Home time',routes:'Routes',equipment:'Equipment',other:'Other priority — details not recorded'} as const)[a.priority]:null,dealbreakers:a.nonNegotiables};
 return guideQuestions.map(q=>{
  const reason=g.reviewReasons[q.id]?.trim()||null,state=answerStatus(g,q.id),guideValue=g.answers[q.id]?.trim(),fallback=legacy[q.id],hasGuide=!!guideValue,hasLegacy=fallback!==null&&fallback!==undefined&&fallback!=='';
  let value=hasGuide?guideValue:hasLegacy?String(fallback):'Not recorded';
  if(hasGuide){value=q.options.find(([v])=>v===guideValue)?.[1]??guideValue;if(q.id==='locationZip')value=guideValue.replace(/\s*\|\s*/g,' · ');if(q.id==='payTarget'){const [amount,basis,period]=guideValue.split(/\s*\|\s*/);if(basis&&period)value=`$${amount} ${basis==='take_home'?'take-home':basis} per ${period==='weekly'?'week':period==='monthly'?'month':period==='annual'?'year':period==='hourly'?'hour':period}`;}}
  if(q.id==='experienceMonths'&&(hasGuide||hasLegacy)&&/^\d+$/.test(value)){const months=Number(value);value=`${months} months${months>=12?` (${Math.floor(months/12)} ${Math.floor(months/12)===1?'year':'years'}${months%12?`, ${months%12} months`:''})`:''}`;}
  const status=reason&&state==='confirmed'?'Needs verification':state==='unanswered'?(hasGuide?'Not confirmed':hasLegacy?'Recorded':'Not answered'):statuses[state];
  return {id:q.id,label:q.label,value,status,reason};
 });
}

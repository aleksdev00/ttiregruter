import {verificationTopics} from './topics.ts';
import bank from './data.json' with {type:'json'};
import type {ScriptContext,ResolvedScript} from '../playbook/engine.ts';
import {verifiedOffer,applicationDestination,sessionPlaybook} from '../../domain/playbook.ts';
import {guideState,guideQuestions,externalApplicationPath,internalPath} from '../../domain/guide.ts';
export const ownerFaq=bank;
export const ownerEntry=(id:string)=>bank.entries.find(e=>e.id===id);
// Facts belong to one opening, one question and one placeholder. A generic
// "policy" from a different answer or carrier must never fill this answer.
export function ownerFact(ctx:ScriptContext,id:string,key:string):string|null {
 const o=ctx.offer;const fromProfile=id==='F075';if(fromProfile?ctx.recruiter.isDemo:!o||o.id!==ctx.conversation.selectedOfferId||!verifiedOffer(o)||Date.parse(o.verifiedAt!)>Date.now())return null;
 const f=(fromProfile?ctx.recruiter.faqFacts:o?.faqFacts)?.[`${id}:${key}`];if(!f||!f.source.trim()||!Number.isFinite(Date.parse(f.verifiedAt))||Date.parse(f.verifiedAt)>Date.now()||!f.expiresAt||!Number.isFinite(Date.parse(f.expiresAt))||Date.parse(f.expiresAt)<=Date.now()||!f.value.trim()||/[\[\]]/.test(f.value))return null;
 return f.value.trim();
}
export function leaseContext(ctx:ScriptContext):boolean {
 const g=guideState(ctx.conversation);if(g.confirmed.position&&['Lease','Owner-operator'].includes(g.answers.position))return true;
 const type=ownerFact(ctx,'F003','verified type')?.toLowerCase();
 return !!type&&(/\blease\b|\bowner.operator\b/.test(type));
}
export function ownerFollowUp(id:string):string {
 const e=ownerEntry(id);const key=({1:'route',2:'payTarget',3:'home',4:'truck',5:'experienceMonths',6:'availability',7:'position',8:'availability'} as Record<number,string>)[e?.category??0];
 return guideQuestions.find(q=>q.id===key)?.spoken??'What would you need to know before deciding whether this is worth another conversation?';
}
export function resolveOwnerFaq(id:string,ctx:ScriptContext):ResolvedScript {
 const e=ownerEntry(id);if(!e)throw new Error('Unknown owner FAQ');
 const g=guideState(ctx.conversation),notes=sessionPlaybook(ctx.conversation).notes;
 const confirmed=(key:string)=>g.confirmed[key]&&!g.reviewReasons[key]?g.answers[key]:null;
 const selected=ctx.offer&&ctx.offer.id===ctx.conversation.selectedOfferId&&verifiedOffer(ctx.offer)?ctx.offer:undefined;
 const missing=new Set<string>();
 const value=(key:string):string|null=>{
  if(['carrier','Carrier','carrier name'].includes(key))return selected?.companyName??null;
  if(key==='driver priority')return confirmed('priority');
  if(key==='ZIP/state'||key==='driver’s location')return confirmed('locationZip')??confirmed('state');
  if(key==='remaining concern')return notes.unresolvedQuestion.trim()||null;
  if(key==='specific action')return notes.nextAction.trim()||null;
  if(key==='detail')return notes.unresolvedQuestion.trim()||null;
  if(['time','realistic date/time'].includes(key)&&notes.dueAt&&notes.dueTimeZone&&Date.parse(notes.dueAt)>Date.now())return new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:notes.dueTimeZone}).format(new Date(notes.dueAt))+` (${notes.dueTimeZone})`;
  return ownerFact(ctx,id,key);
 };
 let text=e.answer.replace(/\[([^\]]+)\]/g,(_,key:string)=>{const actual=value(key);if(actual&&!/[\[\]]/.test(actual))return actual;missing.add(key);return '';});
 // The source's Yankee example is a qualified historical note, not a verified
 // current eligibility rule. Preserve the source, but require current evidence.
 if(/Yankee/.test(e.answer)){
  const requirement=ownerFact(ctx,id,'current experience requirement');
  if(!requirement)missing.add('current experience requirement');
  text=requirement?`The carrier’s current written experience requirement is ${requirement}. I can compare that with your experience, but the carrier makes the final hiring decision.`:'';
 }
 if(['F009','F076'].includes(id)&&!ownerFact(ctx,id,'current written job details'))missing.add('current written job details');
 if(id==='F006'&&!selected)missing.add('verified selected carrier opening');
 if(e.category===7&&!(/lease|owner.operator/i.test(ownerFact(ctx,'F003','verified type')??'')))missing.add('verified lease or owner-operator opening');
 if(missing.size){
  const detail=verificationTopics[Number(id.slice(1))-1]??'offer details';
  text=id==='C001'?'I still need to verify the feature that would make this opening a fit for your priorities. Would you like to review the written details once that is confirmed?':id==='C002'?'I don’t want to guess on something that affects your decision. Let’s identify what needs confirmation and agree on a follow-up time. If it checks out, would you be open to taking the next step?':`I still need to verify the ${detail} before I can answer that accurately. I’ll get the current written details before you decide. I don’t want to guess on something that affects your decision.`;
 }
 if(['F052','F081'].includes(id)&&!externalApplicationPath(ctx.conversation)){
  text=internalPath(ctx.conversation)?'I’ll complete your application here with the answers you gave me. You only need to send your CDL, front and back, and medical card through our document channel.':'Let’s confirm whether you want W-2 or 1099 first.';
  if(id==='F052'&&value('documents'))text+=' The carrier also requires: '+value('documents')+'.';
  if(id==='F081')missing.clear();
 } else text=text.replaceAll('https://apply.ttirecruiting.us/',applicationDestination(ctx.recruiter).url!);
 return {text,coach:'Use current written carrier information. The carrier makes the hiring decision. '+(/Yankee|BBCL/.test(e.answer+' '+(selected?.companyName??''))?'BBCL and Yankee source notes require reconfirmation. ':'')+'Sending or sharing details is a separate authorized action; this workspace does not send them.\nFollow-up: '+ownerFollowUp(id),ready:missing.size===0,missingFacts:Array.from(missing),channel:'spoken',sourceId:id,actionType:missing.size?'verification':'none',subject:null};
}

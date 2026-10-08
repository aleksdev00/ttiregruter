import {resolveV2,legacyV2,v2Comparison,v2Outcome} from './version2.ts';
import {callScenarioLines} from './concise.ts';
import {resolveOwnerFaq} from '../owner-faq/engine.ts';
import {matchConversationOffer} from '../../domain/offerMatching.ts';
import {conversationFlow} from '../../domain/conversation.ts';
import {guideQuestions,guideQuestion,callProgress,acknowledgment,guideProgress,guideState,nextGuideStep,externalApplicationPath,internalPath} from '../../domain/guide.ts';
import data from './data.json' with { type: 'json' };
import type { Contact, Conversation, Recruiter, Offer } from '../../contracts/index.ts';
import { greetingName, matchOffer } from '../../domain/rules.ts';
import { sessionPlaybook, verifiedOffer, qualificationGate, referralReadiness, applicationDestination } from '../../domain/playbook.ts';
export const playbook=data;
export type Scenario=typeof data.scenarios[number];
export const scenarioById=(id:string)=>data.scenarios.find(s=>s.id===id);
export interface ScriptContext {contact:Contact;conversation:Conversation;recruiter:Recruiter;offer?:Offer;offers?:Offer[];applicationDelivery?:'saved_locally'|'pending'|'delivered'|'failed'}
export interface ResolvedScript {text:string;coach:string;ready:boolean;missingFacts:string[];channel:string;sourceId:string;actionType:string;subject:string|null}
const quoteText=(text:string)=>text.startsWith('“')&&text.endsWith('”')?text.slice(1,-1):text;
export function resolveScenario(id:string,ctx:ScriptContext):ResolvedScript {
  if(legacyV2[id])return resolveV2(legacyV2[id],ctx);
  if(/^[BOT]\d{2}$/.test(id))return resolveV2(id,ctx);
  if(['S119','S120','S121','S122','S123','S124','S126','S131','S132','S152'].includes(id)&&!externalApplicationPath(ctx.conversation))return {text:internalPath(ctx.conversation)?'I’ll complete your application here. Please send your CDL, front and back, and medical card through our document channel.':'Let’s confirm W-2 or 1099 first.',coach:'External apply links are W-2 only. Use the internal application and approved document channel for 1099, Lease, and Owner Operator.',ready:false,missingFacts:['W-2 application path'],channel:'spoken',sourceId:id,actionType:'review',subject:null};
  const s=scenarioById(id)??scenarioById('S169')!;const c=ctx.conversation,state=sessionPlaybook(c);const actualOffer=verifiedOffer(ctx.offer)&&ctx.offer&&ctx.offer.id===c.selectedOfferId&&['match','potential_fit'].includes(matchOffer(ctx.offer,c.answers).state)?ctx.offer:undefined;
  const values:Record<string,string|null|undefined>={Name:greetingName(ctx.contact,c.answers),Recruiter:ctx.recruiter.alias,'professional alias':ctx.recruiter.alias,'real name':ctx.recruiter.fullName,'callback number':ctx.recruiter.callbackNumber,'Verified contact email':ctx.recruiter.contactEmail,'verified source':ctx.contact.sourceLabel&&ctx.contact.sourceLabel!=='Synthetic demo fixture'?ctx.contact.sourceLabel:null,Company:actualOffer?.companyName,'verified Company':actualOffer?.companyName,'verified referral link':externalApplicationPath(c)?referralReadiness(ctx.recruiter).url:null,'Verified application link, if agreed':externalApplicationPath(c)&&state.communicationPermission==='allowed'?referralReadiness(ctx.recruiter).url:null,priority:guideState(c).confirmed.priority?guideState(c).answers.priority:c.answers.priority?.replace('_',' ')};
  const missing=new Set<string>();let text=callScenarioLines[s.id]??quoteText(s.canonicalSpoken),subject=s.subject;
  if(!values.Name){text=text.replace(/^Hey \[Name\], /,'Hey, ').replace(/^\[Name\], /,'').replace(/^Hi \[Name\],/,'Hi,');}
  const fill=(value:string)=>value.replace(/\[([^\]]+)\]/g,(_,key:string)=>{const actual=values[key];if(actual&&actual.trim())return actual;missing.add(key);return `[${key}]`;});
  text=fill(text);if(subject)subject=fill(subject);
  if([135,148,153,156].includes(Number(id.slice(1)))&&state.applicationStatus==='unknown')missing.add('verified prior conversation/application status as required');
  if([136,139,140,141,142].includes(Number(id.slice(1))))missing.add('verified application or orientation evidence');
  if([61,62,63,64,68,70,90,94,97,98].includes(Number(id.slice(1)))&&!actualOffer)missing.add('current approved offer terms');
  if(s.metadata.channel==='operational')return {text:'',coach:s.canonicalSpoken+'\n'+s.coach,ready:false,missingFacts:[],channel:'operational',sourceId:s.id,actionType:s.metadata.actionType,subject:null};
  if(missing.size)return {text:resolveV2('O33',ctx).text,coach:s.coach,ready:false,missingFacts:[...missing],channel:s.metadata.channel,sourceId:s.id,actionType:s.metadata.actionType,subject:null};
  return {text,coach:s.coach,ready:true,missingFacts:[],channel:s.metadata.channel,sourceId:s.id,actionType:s.metadata.actionType,subject};
}
function extractMain(heading:string):string[] {
  const section=data.sections.find(s=>s.number===2)!.rawSource;const block=section.split(`### ${heading}\n`)[1]?.split('\n### ')[0]??'';
  return [...block.matchAll(/“([^”]+)”/g)].map(m=>m[1]);
}
export function currentCallScript(ctx:ScriptContext):ResolvedScript & {nextAction:string} {
 const c=ctx.conversation,flow=conversationFlow(c);
 const nextAction='Confirm the answer to advance automatically to the next unanswered question.';
 if(flow.stage==='opening')return {...resolveV2('B01',ctx),nextAction:'Choose the actual response. Busy means agree a callback and finish.'};
 if(flow.stage==='objection_selection')return {...resolveV2('O04',ctx),...(flow.objectionId?{text:'What’s the main concern you’d like me to address?'}:{}),nextAction:'Use this permission question once. Interested now resumes; a clear refusal ends the pitch.'};
 if(flow.stage==='objection_response')return {...resolveScenario(flow.objectionId??'S169',ctx),nextAction:['S007','S009'].includes(flow.objectionId??'')?'Agree the actual callback time and save the callback outcome.':'Choose interested now, another reason, still not interested, or Do Not Contact.'};
 if(flow.stage==='voicemail')return {...resolveV2('O38',ctx),nextAction:'Read the complete voicemail, then record whether you actually left it.'};
 if(flow.stage==='outcome_review'||flow.stage==='finished')return {...v2Outcome(ctx),nextAction:'Choose the actual outcome and save before finishing. Finish does not submit an application.'};
 if(flow.stage==='offer_comparison')return {...v2Comparison(ctx),nextAction:'Review at most two compatible companies. Verify missing conditions before quoting terms. Selection is not agreement or receipt.'};
 if(flow.stage==='application_next_step'&&ctx.applicationDelivery)return {...(ctx.applicationDelivery==='delivered'?v2Outcome(ctx):resolveV2('O37',ctx)),nextAction:'Review the actual delivery status below. Retry the same application only when permitted; carrier approval is separate.'};
 if(flow.stage==='application_next_step')return {...resolveV2(externalApplicationPath(c)?'B03':'B09',ctx),nextAction:externalApplicationPath(c)?'Record agreement and permission. Use the configured recruiter referral link; agree a realistic follow-up. Opening is not receipt.':'Record the actual agreement, review the internal application and document checklist, then use explicit Submit Application when ready.'};
 const step=flow.stage==='qualification'?nextGuideStep(c):c.activeStepId;
 if(step==='incidents')return {text:'Any moving violations or accidents I need to account for?',coach:'Ask this separately from SAP. Record the type and date, repeat corrected dates back, and keep driver-reported history separate from carrier clearance.',ready:true,missingFacts:[],channel:'spoken',sourceId:'B06 · incidents',actionType:'review',subject:null,nextAction:'Confirm the incident note or record an explicit unknown reason. Do not store tickets or accidents in SAP.'};
 const q=guideQuestion(step);
 if(q)return {text:acknowledgment(c)+q.spoken,coach:`Ask only this unanswered question. ${q.id==='home'?'The answer field records days out; record required days at home in Notes. ':''}${q.id==='experienceMonths'?'Convert recent verifiable CDL-A years to whole months. ':''}${q.id==='sap'?'SAP is separate from incident dates and types. Completed SAP never overrides carrier exclusions. ':''}Unknown answers need a reason. Additional preferences remain optional unless material.`,ready:true,missingFacts:[],channel:'spoken',sourceId:`${['position','employmentType'].includes(q.id)?'B02':['state','locationZip','route','home','trailer','truck'].includes(q.id)?'B05':'B06'} · ${q.id}`,actionType:'review',subject:null,nextAction};
 if(step==='w2_handoff')return {...resolveV2('B03',ctx),nextAction:'Record agreement and permission before the handoff.'};
 if(step==='offer')return {...v2Comparison(ctx),nextAction:'Review the confirmed driver summary and compatible companies.'};
 return {...resolveV2('O11',ctx),nextAction:'Clarify the actual application path.'};
}
export function searchScenarios(query:string,category:string='all',path:string='all'):Scenario[] {
  const tokens=query.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean);
  return data.scenarios.filter(s=>(category==='all'||String(s.section)===category)&&(path==='all'||s.metadata.employmentPaths.includes(path))&&tokens.every(t=>`${s.id} ${s.title} ${s.category} ${s.canonicalSpoken} ${s.coach} ${s.metadata.keywords.join(' ')}`.toLowerCase().includes(t)));
}
export function suggestions(ctx:ScriptContext):string[]{
  if(ctx.conversation.answers.employment==='w2')return ['S029','S120','S131','S169'];
  if(ctx.conversation.answers.employment==='1099')return ['S030','S039','S057','S169'];
  if(ctx.conversation.activeStepId==='employment')return ['S031','S032','S036'];
  return ['S003','S017','S013','S169'];
}
export function paginateContent(text:string,max=90):string[]{
  if(!text)return ['No spoken message. Follow the recruiter action.'];const pages:string[]=[];let start=0;
  while(start<text.length){let end=Math.min(start+max,text.length);if(end<text.length){const boundary=Math.max(text.lastIndexOf(' ',end),text.lastIndexOf('\n',end));if(boundary>start)end=boundary+1;}pages.push(text.slice(start,end));start=end;}
  return pages;
}
export function resources(){return data.sections.filter(s=>[1,2,16,17,18,19].includes(s.number));}

export function scenarioFollowUp(id:string,ctx:ScriptContext):string {
 const scenario=scenarioById(id);if(!scenario)return resolveScenario('S026',ctx).text;
 const n=Number(id.slice(1));let questionId:string|undefined;
 if([37,38].includes(n))questionId='locationZip';
 else if(n>=39&&n<=45)questionId='experienceMonths';
 else if(n>=46&&n<=50)questionId='sap';
 else if(n>=51&&n<=58)questionId='dealbreakers';
 else if(scenario.section===5)questionId='employmentType';
 else if(scenario.section===7||n===19)questionId='payTarget';
 else if([73,74,75,20].includes(n))questionId='home';
 else if(n>=76&&n<=79)questionId='route';
 else if(n===80)questionId='trailer';
 else if([81,82,83,85].includes(n))questionId='truck';
 else if(n===84)questionId='position';
 else if([4,13,14].includes(n))return resolveScenario('S013',ctx).text;
 if(questionId){const spoken=guideQuestions.find(q=>q.id===questionId)!.spoken;if(spoken)return spoken;return currentCallScript({...ctx,conversation:{...ctx.conversation,playbook:{...sessionPlaybook(ctx.conversation),flow:{...conversationFlow(ctx.conversation),stage:'qualification'}}}}).text;}
 return resolveScenario([9,10,11].includes(scenario.section)?'S114':scenario.section===12?'S119':'S026',ctx).text;
}

export function companyTalkTrack(offer:Offer,c:Conversation):string|null {
 const guide=guideState(c),priority=guide.confirmed.priority&&!guide.reviewReasons.priority?guide.answers.priority:null;
 if(offer.documentedTerms&&offer.id===c.selectedOfferId&&!['not_fit','unavailable'].includes(matchConversationOffer(offer,c).state)){const terms=offer.documentedTerms;return `Let’s check ${offer.companyName}. The workbook lists: ${terms.summary} I’ll confirm the current opening and terms. Want me to check this one for you?`; }
 if(!verifiedOffer(offer)||offer.id!==c.selectedOfferId||!priority||['not_fit','unavailable'].includes(matchConversationOffer(offer,c).state))return null;
 const p=offer.pay;if(p.min===null||p.max===null||!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.min<0||p.max<p.min||p.unit==='unknown'||p.basis==='unknown'||!offer.homeTime||!offer.routeType)return null;
 const amount=(value:number)=>'$'+new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(value);
 const range=p.min===p.max?amount(p.min):`${amount(p.min)} to ${amount(p.max)}`;
 const pay=p.unit==='percentage'?`${p.min===p.max?p.min:`${p.min} to ${p.max}`} percent under the documented revenue definition`:`${range} ${({cpm:'per paid mile',weekly:'per week',hourly:'per hour'} as Record<string,string>)[p.unit]}`;
 const home=({daily:'daily home time',weekly:'weekly home time',flexible:'the documented flexible home-time schedule'} as const)[offer.homeTime];
 const route=({otr:'over-the-road routes',regional:'regional routes',local:'local routes'} as const)[offer.routeType];
 return `You want ${priority}. Here is how ${offer.companyName} lines up: ${p.basis==='advertised'?'advertised':'documented'} pay of ${pay}, ${home}, and ${route}. How does that line up with what you want?`;
}

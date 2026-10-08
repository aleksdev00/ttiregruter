import bank from './version2.json' with {type:'json'};
import type {ScriptContext,ResolvedScript} from './engine.ts';
import type {Offer} from '../../contracts/index.ts';
import {greetingName} from '../../domain/rules.ts';
import {conversationFlow} from '../../domain/conversation.ts';
import {guideState,externalApplicationPath,internalPath,presentationContextReady,guideQuestions} from '../../domain/guide.ts';
import {sessionPlaybook,verifiedOffer,referralReadiness} from '../../domain/playbook.ts';
import {matchConversationOffer,suitableShortlist} from '../../domain/offerMatching.ts';
export const version2=bank;
export const v2Block=(id:string)=>bank.blocks.find(b=>b.id===id);
export const legacyV2:Record<string,string>={S002:'O06',S003:'O07',S007:'O01',S009:'O02',S013:'O10',S017:'O05',S019:'O12',S020:'O15',S029:'B03',S030:'B09',S031:'O11',S032:'O11',S087:'O22',S106:'O24',S107:'O23',S147:'O38',S169:'O33'};
const clean=(v:string|null|undefined)=>v?.trim()&&!/[\[\]\r\n]/.test(v)?v.trim():null;
export function confirmedV2(ctx:ScriptContext,id:string){const g=guideState(ctx.conversation);return g.confirmed[id]&&!g.reviewReasons[id]?clean(g.answers[id]):null;}
function selected(ctx:ScriptContext){return ctx.offer&&ctx.offer.id===ctx.conversation.selectedOfferId&&!['not_fit','unavailable'].includes(matchConversationOffer(ctx.offer,ctx.conversation).state)?ctx.offer:undefined;}
function fact(ctx:ScriptContext,id:string,key:string){
 const o=selected(ctx),stores=[ctx.recruiter.isDemo?undefined:ctx.recruiter.faqFacts,o&&verifiedOffer(o)?o.faqFacts:undefined];
 for(const store of stores){const f=store?.[`${id}:${key}`];if(f&&f.source.trim()&&Number.isFinite(Date.parse(f.verifiedAt))&&Date.parse(f.verifiedAt)<=Date.now()&&Number.isFinite(Date.parse(f.expiresAt))&&Date.parse(f.expiresAt)>Date.now()&&clean(f.value))return clean(f.value);}
 return null;
}
function callback(ctx:ScriptContext){const notes=sessionPlaybook(ctx.conversation).notes,date=notes.dueAt??(conversationFlow(ctx.conversation).outcomeDraft.outcome==='callback'?conversationFlow(ctx.conversation).outcomeDraft.callbackAt:null);if(!date||!notes.dueTimeZone||!Number.isFinite(Date.parse(date)))return null;try{return new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:notes.dueTimeZone}).format(new Date(date))+` (${notes.dueTimeZone})`;}catch{return null;}}
function opening(ctx:ScriptContext){const name=greetingName(ctx.contact,ctx.conversation.answers),alias=clean(ctx.recruiter.alias);return name?`Hey ${name}, it's ${alias??'your recruiter'} with TTI Recruiting. You got a minute to talk about CDL-A jobs?`:`Hi, this is ${alias??'your recruiter'} with TTI Recruiting. You got a minute to talk about CDL-A jobs?`;}
export function v2Summary(ctx:ScriptContext){
 const bits:string[]=[],get=(id:string)=>confirmedV2(ctx,id),position=get('position'),path=internalPath(ctx.conversation)&&position==='Company driver'?'1099':externalApplicationPath(ctx.conversation)?'W-2':null;
 if(position)bits.push(`you want ${position.toLowerCase()} work${path?' on the '+path+' path':''}`);
 const location=[get('locationZip')?.replace(' | ', ', '),get('state')].filter(Boolean).join(', ');if(location)bits.push(`you're based in ${location}`);
 if(get('priority'))bits.push(`${get('priority')} matters most`);
 if(get('route'))bits.push(`you want ${get('route')} routes`);
 if(get('trailer'))bits.push(`you prefer ${get('trailer')} trailers`);
 if(get('home'))bits.push(`you can stay out ${get('home')} days before going home`);
 if(get('availability'))bits.push(`you could start ${get('availability')?.toLowerCase()} after approval`);
 return bits.length?`Let me check I've got this right: ${bits.join('; ')}. Did I miss anything?`:'Let’s confirm your home base and what matters most before comparing companies.';
}
export function verifiedV2Terms(o:Offer,ctx:ScriptContext):string|null {
 if(!verifiedOffer(o)||['not_fit','unavailable'].includes(matchConversationOffer(o,ctx.conversation).state))return null;
 const p=o.pay;if(p.min===null||p.max===null||p.min<0||p.max<p.min||!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.unit==='unknown'||p.basis==='unknown'||!o.homeTime||!o.routeType)return null;
 const n=(x:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(x),range=p.min===p.max?n(p.min):`${n(p.min)} to ${n(p.max)}`;
 const pay=p.unit==='percentage'?`${range}% under the documented revenue definition`:`$${range} ${({cpm:'per paid mile',weekly:'per week',hourly:'per hour'} as Record<string,string>)[p.unit]}`;
 return `${p.basis} pay of ${pay}, ${o.homeTime} home time, and ${o.routeType==='otr'?'OTR':o.routeType} routes${p.note?'. '+p.note:''}`;
}
export function v2Comparison(ctx:ScriptContext):ResolvedScript {
 if(!presentationContextReady(ctx.conversation)){const g=guideState(ctx.conversation),missing=['state','locationZip','route','home'].filter(id=>!g.confirmed[id]&&!g.reviewReasons[id]),q=guideQuestions.find(q=>q.id===missing[0]);return {text:v2Summary(ctx)+'\n\n'+(q?.spoken??'I still need to verify your home base and schedule before presenting a company as a fit.'),coach:v2Block('B07')!.coach,ready:false,missingFacts:missing.length?missing:['confirmed home base and schedule'],channel:'spoken',sourceId:'B07 / B05',actionType:'review',subject:null};}
 const choices=suitableShortlist(ctx.offers??(ctx.offer?[ctx.offer]:[]),ctx.conversation).filter(x=>verifiedV2Terms(x.offer,ctx));
 const missing:string[]=[],priority=confirmedV2(ctx,'priority');let text='';
 if(choices.length){text=`${priority?'Based on '+priority+', I’d start with':'I’d start with'} ${choices[0].offer.companyName}. Its current documented terms are ${verifiedV2Terms(choices[0].offer,ctx)}. `;if(choices[1])text+=`${choices[1].offer.companyName} lists ${verifiedV2Terms(choices[1].offer,ctx)}. Which is closer to what you want?`;else text+='This is the one option I can discuss with verified terms. How does it line up with what you want?';}
 else {text='I don’t have a compatible option with current verified terms to quote yet. I’ll check the remaining requirements and current openings before asking you to choose. Would you like a follow-up once those details are confirmed?';missing.push('compatible current verified carrier terms');}
 return {text:v2Summary(ctx)+'\n\n'+text,coach:v2Block('B07')!.coach+'\n'+v2Block('B08')!.coach+'\n'+choices.map(x=>`${x.offer.companyName}: ${x.offer.source}; verified ${x.offer.verifiedAt}; ${x.match.missingFacts.join('; ')}`).join('\n'),ready:!missing.length,missingFacts:missing,channel:'spoken',sourceId:'B07 / B08',actionType:'review',subject:null};
}
export function v2Outcome(ctx:ScriptContext):ResolvedScript {
 const c=ctx.conversation,f=conversationFlow(c),state=sessionPlaybook(c),outcome=f.outcomeDraft.outcome,notes=state.notes;
 let text=outcome==='do_not_contact'?v2Block('O10')!.spoken:outcome==='not_interested'?'Fair enough. Thanks for your time.':outcome==='wrong_number'?v2Block('O09')!.spoken:outcome==='no_answer'?(f.voicemailStatus==='reported_left'?'Voicemail recorded as left. Save the no-answer outcome.':'No answer recorded. Save whether a voicemail was actually left.') :outcome==='callback'?(callback(ctx)?`We’ll follow up ${callback(ctx)}. Thanks for your time.`:'What date, time, and time zone should I record for the callback?'):notes.nextAction?`Here's the next step: ${notes.nextAction}.`:'Let’s confirm the next action and save the actual call outcome.';
 if(!['do_not_contact','not_interested','wrong_number','no_answer','callback'].includes(outcome??'')){
  if(ctx.applicationDelivery==='delivered')text+=' Your application was delivered to LiveHQ. Carrier receipt and approval still require confirmation.';
  else if(ctx.applicationDelivery)text+=' Your application details are saved locally. LiveHQ delivery is not confirmed yet.';
  else if(state.externalReceipt)text+=' We have a recorded external receipt. Carrier approval still requires confirmation.';
  else if(state.applicationStatus==='driver_reported')text+=' I’ll check the submission record; receipt is not confirmed yet.';
  else if(f.applicationIntent==='agreed')text+=' Agreement is recorded; application receipt has not been confirmed.';
  if(callback(ctx))text+=` We’ll follow up ${callback(ctx)}.`;
 }
 return {text,coach:v2Block('B10')!.coach+'\nFinish saves the outcome and invokes the separate owner-summary process. It does not submit an application. Check delivery status separately.',ready:true,missingFacts:[],channel:['no_answer'].includes(outcome??'')?'operational':'spoken',sourceId:'B10',actionType:'review',subject:null};
}
export function resolveV2(id:string,ctx:ScriptContext):ResolvedScript {
 const b=v2Block(id);if(!b)throw new Error('Unknown owner-script block');
 if(id==='B07')return {...v2Comparison(ctx),text:v2Summary(ctx),sourceId:id};
 if(id==='B08')return v2Comparison(ctx);if(id==='B10')return v2Outcome(ctx);
 const c=ctx.conversation,notes=sessionPlaybook(c).notes,o=selected(ctx),alias=clean(ctx.recruiter.alias)??'your recruiter',name=greetingName(ctx.contact,c.answers),when=callback(ctx),missing=new Set<string>();
 const values:Record<string,string|null|undefined>={Name:name,Recruiter:alias,Company:o?.companyName,'known location':[confirmedV2(ctx,'locationZip'),confirmedV2(ctx,'state')].filter(Boolean).join(', ')||null,'verified contact source':clean(ctx.contact.sourceLabel)&&ctx.contact.sourceLabel!=='Synthetic demo fixture'?ctx.contact.sourceLabel:null,'corrected name':clean(c.answers.preferredName),'verified callback number':clean(ctx.recruiter.callbackNumber),'recorded requirement':confirmedV2(ctx,'priority')??clean(notes.nonNegotiables),'specific fact':clean(notes.unresolvedQuestion),'specific question':clean(notes.unresolvedQuestion),'agreed time':when,'agreed date, time and time zone':when,'configured recruiter referral URL':externalApplicationPath(c)&&referralReadiness(ctx.recruiter).ready?referralReadiness(ctx.recruiter).url:null};
 let text=b.spoken;
 if(id==='B01')text=opening(ctx);
 if(!name)text=text.replace('Hey [Name],', 'Hi,').replace('Hi [Name],','Hi,').replace('Thanks, [Name].','Thanks.');
 if(id==='O38'&&!values['verified callback number']){text=text.replace("If you'd like to compare options on pay, home time or equipment, call me at [verified callback number]. Again, [Recruiter] with TTI Recruiting, [verified callback number]. ",'');missing.add('verified callback number');}
 text=text.replace(/\[([^\]]+)\]/g,(_,key:string)=>{const v=values[key]??fact(ctx,id,key);if(clean(v))return clean(v)!;missing.add(key);return '';});
 // Do not expose clipped placeholder sentences. Each missing-fact branch is a complete response.
 if(missing.size&&id!=='O38'){
  text=('fallback' in b&&b.fallback)||({
   O02:'Sure. What date and time work for you, and what time zone will you be in?',
   O08:`No problem. I'm ${alias} with TTI Recruiting. I’ll correct the contact information. Are you open to hearing about driving options?`,
   O20:'What type of incident was it, and when did it happen? Let me repeat the type and date back to you before I record them.',
   O25:`I still need to confirm the remaining carrier requirements${o?' with '+o.companyName:''}. I don’t want you making a move on an unconfirmed detail. When would you like me to follow up?`,
   O27:'No problem. When can you send your CDL front and back and medical card? I’ll confirm the approved document channel with you first and keep the application pending until the required items are in.',
   O33:`I don’t have a confirmed answer to that yet. I’ll check your exact question${o?' with '+o.companyName:''}. Does that need to be settled before you move forward? What time would work for a follow-up?`,
   O34:opening(ctx),O39:opening(ctx),
   T01:`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. I still need to verify the details you requested before quoting them. Let me know which detail matters most to you.`,
   T02:`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. What date, time, and time zone work for a callback?`,
   T03:`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. I’ll confirm your application link and our follow-up time before sharing them.`,
   T04:`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. To continue the internal application, we need your CDL front and back and medical card. I’ll confirm the approved document channel and follow-up time with you.`,
   T05:`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. I’ll confirm which required documents are still missing and the time you’d like to follow up.`,
   T06:`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. I’m checking the actual submission status and next step. I’ll update you once receipt is confirmed.`,
   B09:o?`Would you like me to move forward with your application for ${o.companyName}?`:'Let’s choose a compatible company and confirm its terms before moving forward with the application.',
  } as Record<string,string>)[id]||'I still need to verify that specific detail before I can answer accurately. Let’s identify what needs checking and agree on the next step.';
 }
 if(id==='T03'&&externalApplicationPath(c)&&sessionPlaybook(c).communicationPermission==='allowed'&&values['configured recruiter referral URL'])text=`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. Here's the driver application link we agreed on: ${values['configured recruiter referral URL']}.${when?' We’ll follow up '+when+'.':''}${values['verified callback number']?' My number is '+values['verified callback number']+'.':''}`;
 if(id==='T02'&&when)text=`Hi${name?' '+name:''}, it's ${alias} with TTI Recruiting. We're set to talk ${when}${values['recorded requirement']?' about '+values['recorded requirement']:''}.${values['verified callback number']?' My number is '+values['verified callback number']+'.':''}`;
 if(id==='B03'&&sessionPlaybook(c).communicationPermission==='allowed')text=when?`If something does not work, let me know. We’ll follow up ${when}.`:conversationFlow(c).applicationIntent==='agreed'?"I'll send it to this number. If something does not work, let me know. What time would work for us to follow up?":'Would you like to proceed with the W-2 driver application?';
 if(id==='B09'&&conversationFlow(c).applicationIntent==='agreed'){
  const channel=fact(ctx,id,'approved document channel');text=`Great. I'll complete it here using the details we've discussed. Next, please send your CDL front and back and your medical card${channel?' through '+channel:'. I’ll confirm the approved document channel with you first'}. Once we have the required information, we can submit it for the company’s review.`;if(!channel)missing.add('approved document channel');
 }
 if(['T03','O36'].includes(id)&&(!externalApplicationPath(c)||sessionPlaybook(c).communicationPermission!=='allowed')){missing.add('explicit W-2 application-link permission');text='Let’s confirm the W-2 application path and your permission before sharing or following up on an application link.';}
 if(['T04','T05'].includes(id)&&(!internalPath(c)||conversationFlow(c).applicationIntent!=='agreed')){missing.add('internal application agreement');text='Let’s confirm the company and your agreement to the internal application before requesting documents.';}
 if(id==='O37'&&!ctx.applicationDelivery){missing.add('confirmed local application record');text='I’m checking the actual submission status. I’ll update you once it is confirmed.';}
 if(id==='T06'&&ctx.applicationDelivery==='delivered'){text='Your application has been received in LiveHQ. Carrier receipt and approval still require confirmation.'+(clean(notes.nextAction)?' The next step is '+notes.nextAction+'.':' I’ll confirm the next review step.');missing.clear();}
 if(id==='T06'&&!sessionPlaybook(c).externalReceipt&&ctx.applicationDelivery!=='delivered'){missing.add('verified receipt evidence');text='I’m checking the actual submission status and next step. I’ll update you once receipt is confirmed.';}
 return {text,coach:b.coach+('next' in b?'\nNext: '+b.next:'')+('followThrough' in b?'\nFollow-through (use only after the actual answer): '+b.followThrough:'')+(missing.size?'\nMissing information: '+[...missing].join(', '):''),ready:!missing.size,missingFacts:[...missing],channel:id.startsWith('T')?'text':id==='O38'?'voicemail':'spoken',sourceId:id,actionType:id==='O10'?'suppress':id==='O09'?'wrong_number':['O01','O02','O03'].includes(id)?'callback':id==='O40'?'decline':missing.size?'verification':'review',subject:null};
}

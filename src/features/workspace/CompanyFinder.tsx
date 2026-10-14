'use client';
import {useMemo, useState} from 'react';
import type {Conversation,Contact,Offer,OfferMatch,CallOutcome} from '../../contracts';
import {matchConversationOffer} from '../../domain/offerMatching';
import {guideState} from '../../domain/guide';
import {callbackInstant} from '../../domain/callback-time';
import {projectFinderConversation,type FinderFilters} from '../../domain/finder-projection';
import {offerPresentation} from '../../domain/offer-presentation';
import {displayName} from '../../domain/rules';
import s from './CompanyFinder.module.css';

type FilterKey=keyof FinderFilters;
const keys:FilterKey[]=['position','employmentType','home','trailer','experienceMonths','sap'];
const options:Record<FilterKey,[string,string][]>= {
 position:[['Company driver','Company driver'],['Lease','Lease'],['Owner-operator','Owner-operator']],
 employmentType:[['W-2','W-2'],['1099','1099'],['Either','Either']],
 home:[['1','Daily'],['7','Weekly'],['14','2 weeks'],['flexible','Flexible']],
 trailer:[['Dry van','Dry van'],['Reefer','Reefer'],['Flatbed','Flatbed']],
 experienceMonths:[['0-6','0–6 months'],['6-12','6–12 months'],['12-24','1–2 years'],['24+','2+ years']],
 sap:[['no','No SAP'],['needsrtd','SAP; RTD needed'],['completed','RTD completed'],['unknown','SAP status unknown']],
};
const labels:Record<FilterKey,string>={position:'Position Type',employmentType:'1099 / W-2',home:'Home time',trailer:'Trailer type',experienceMonths:'CDL-A experience',sap:'SAP status'};
const expBounds=(v:string):[number,number|null]|null=>v==='0-6'?[0,6]:v==='6-12'?[6,12]:v==='12-24'?[12,24]:v==='24+'?[24,null]:null;
function initialFilters(c:Conversation):FinderFilters{
 const g=guideState(c);const vals:FinderFilters={position:'',employmentType:'',home:'',trailer:'',experienceMonths:'',sap:''};
 for(const key of keys){if(g.confirmed[key]&&!g.reviewReasons[key])vals[key]=g.answers[key]??'';}
 if(['21','28','35'].includes(vals.home))vals.home='flexible';
 if(!vals.position&&c.answers.position&&c.answers.position!=='unknown')vals.position=({'company':'Company driver','lease':'Lease','owner_operator':'Owner-operator'} as const)[c.answers.position]??'';
 if(!vals.employmentType&&['w2','1099','either'].includes(c.answers.employment))vals.employmentType=({'w2':'W-2','1099':'1099','either':'Either'} as const)[c.answers.employment as 'w2'|'1099'|'either'];
 if(!vals.home&&['daily','weekly','flexible'].includes(c.answers.homeTimePreference))vals.home=({'daily':'1','weekly':'7','flexible':'flexible'} as const)[c.answers.homeTimePreference as 'daily'|'weekly'|'flexible'];
 const months=g.confirmed.experienceMonths&&!g.reviewReasons.experienceMonths?Number(g.answers.experienceMonths):c.answers.experienceMonths;
 if(months!==null&&months!==undefined){vals.experienceMonths=months<6?'0-6':months<12?'6-12':months<24?'12-24':'24+';}
 return vals;
}
function experienceThreshold(offer:Offer):number|null{
 const thresholds=[offer.minExperienceMonths,offer.matchingCriteria?.minimumExperienceMonths??null,...(offer.requirements??[]).filter(r=>r.field==='experienceMonths').flatMap(r=>r.values.map(Number).filter(Number.isFinite))].filter((n):n is number=>n!==null&&Number.isFinite(n));
 return thresholds.length?Math.max(...thresholds):null;
}
function resultFor(offer:Offer,c:Conversation,filters:FinderFilters):OfferMatch{
 const result=matchConversationOffer(offer,projectFinderConversation(c,filters));const bounds=expBounds(filters.experienceMonths),required=experienceThreshold(offer);
 if(bounds&&required!==null&&(bounds[1]===null?required>bounds[0]:required>bounds[0]&&required<=bounds[1])){
  const expConflict=result.conflicts.some(x=>/experience/i.test(x));
  if(expConflict){result.conflicts=result.conflicts.filter(x=>!/experience/i.test(x));result.missingFacts.push(`Experience range includes drivers below this program's ${required}-month minimum; verify the driver's exact experience.`);result.state='needs_confirmation';}
 }
 return result;
}
type ProgramResult={offer:Offer;match:OfferMatch};
type FinishChoice='no_answer'|'voicemail_left'|'voicemail_unavailable'|'callback'|'interested'|'not_interested'|'wrong_number'|'do_not_contact';
const finishChoices:[FinishChoice,string][]=[['no_answer','No answer'],['voicemail_left','Voicemail left'],['voicemail_unavailable','Could not leave voicemail'],['callback','Callback agreed'],['interested','Interested'],['not_interested','Not interested'],['wrong_number','Wrong number'],['do_not_contact','Do not contact']];
export function CompanyFinder({conversation,contact,offers,onReturn,onChoose,canCancel,onCancel,onFinish,seniorOnly}:{conversation:Conversation;contact:Contact;offers:Offer[];onReturn:()=>void;onChoose:(offer:Offer,filters:FinderFilters)=>Promise<string|null>;canCancel:boolean;onCancel:()=>Promise<string|null>;onFinish:(outcome:CallOutcome,callbackAt:string|null,voicemailStatus:'left'|'unavailable'|null,filters:FinderFilters)=>Promise<string|null>;seniorOnly:boolean}){
 const callbackZone=String(conversation.playbook?.notes.dueTimeZone||contact.rawFields.callbackTimeZone||'America/Chicago');
 const recommendation=conversation.playbook?.finderRecommendation;
 const [selectedOfferId,setSelectedOfferId]=useState<string|null>(recommendation?.offerId??null);
 const [finishChoice,setFinishChoice]=useState<FinishChoice|''>(''),[callback,setCallback]=useState(''),[finishSaving,setFinishSaving]=useState(false),[finishMessage,setFinishMessage]=useState('');
 const [filters,setFilters]=useState<FinderFilters>(()=>initialFilters(conversation));
 const [detail,setDetail]=useState<string|null>(null);
 const [saving,setSaving]=useState(false),[message,setMessage]=useState('');
 const results=useMemo(()=>offers.filter(o=>!o.isDemo&&o.source!=='synthetic'&&o.active&&o.approvalStatus==='approved'&&o.recruitingApproved!==false).map(offer=>({offer,match:resultFor(offer,conversation,filters)})).filter(x=>!['not_fit','unavailable'].includes(x.match.state)),[offers,conversation,filters]);
 const groups=useMemo(()=>{const grouped=new Map<string,ProgramResult[]>();for(const item of results){const key=item.offer.companyName.trim().toLocaleLowerCase();grouped.set(key,[...(grouped.get(key)??[]),item]);}
  return [...grouped.values()].map(items=>{const compatiblePrograms=items.filter(x=>x.match.state==='match'||x.match.state==='potential_fit'),needsReview=items.filter(x=>x.match.state==='needs_confirmation');return {name:items[0].offer.companyName,programs:compatiblePrograms,review:needsReview,urgent:items.some(x=>x.offer.urgent===true)};}).filter(g=>g.programs.length||g.review.length).sort((a,b)=>Number(b.urgent)-Number(a.urgent)||Number(b.programs.length>0)-Number(a.programs.length>0)||b.programs.length-a.programs.length||a.name.localeCompare(b.name));},[results]);
 const urgent=groups.filter(g=>g.urgent),compatible=groups.filter(g=>!g.urgent&&g.programs.length),review=groups.filter(g=>!g.urgent&&!g.programs.length&&g.review.length);
 const change=(key:FilterKey,value:string)=>setFilters(old=>({...old,[key]:value}));
 const renderGroup=(g:typeof groups[number],isReview=false)=><article key={g.name} className={s.company} data-urgent={g.urgent}>
  <div className={s.companyHead}><div><div className={s.companyName}>{g.name}{g.urgent&&<span className={s.hot}>{isReview?'HOT SEAT · VERIFY FIT':'HOT SEAT'}</span>}</div><p>{isReview?'Urgent company · needs verification before recommendation':`${g.programs.length} compatible program${g.programs.length===1?'':'s'}`}</p></div></div>
  <div className={s.programs}>{(isReview?g.review:g.programs).map(({offer,match})=>{const id=`${g.name}:${offer.id}`,open=detail===id,summary=offerPresentation(offer);return <section className={s.program} key={offer.id}>
   <div className={s.programTitle}><strong>{summary.programLabel}</strong><span data-state={isReview?'review':'match'}>{isReview?'Verify details':match.state==='match'?'Compatible':'Compatible · discuss preferences'}</span></div>
   <p>{summary.rows[0]?.value}</p><button className={s.detailsToggle} onClick={()=>setDetail(open?null:id)} aria-expanded={open}>{open?'Hide offer details':'Details'}</button>
   <button className={s.choose} disabled={saving} onClick={async()=>{setSaving(true);setMessage('');try{const error=await onChoose(offer,filters);if(error){setMessage(error);setSaving(false);}else{setSelectedOfferId(offer.id);setMessage(isReview?'Company saved for owner review. Its fit is not yet confirmed.':'Company/program saved for the owner summary.');setSaving(false);}}catch{setMessage('Could not save the company choice. Retry from this card.');setSaving(false);}}}>{selectedOfferId===offer.id?(isReview?'Selected · review needed':'Selected'):saving?'Saving…':isReview?'Select for review':'Choose this company'}</button>
   {open&&<div className={s.details}><dl>{summary.rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p><strong>Catalog status:</strong> {summary.status}</p>{isReview&&<p><strong>To verify:</strong> {[...match.missingFacts,...summary.verification].join(' · ')||'Confirm exact driver requirements against current terms.'}</p>}</div>}
  </section>;})}</div>
 </article>;
 return <main className={s.finder} aria-label="Company Finder">
  <header className={s.header}><div><span>TTI RECRUITER · SENIOR / ADMIN / OWNER</span><h1>Company Finder</h1><p>Matching for <strong>{displayName(contact)}</strong>. Changes update the results immediately and do not overwrite recorded driver answers.</p></div><div className={s.headerActions}>{canCancel&&<button className={s.cancel} disabled={saving||finishSaving} onClick={async()=>{setSaving(true);setMessage('');try{const error=await onCancel();if(error){setMessage(error);setSaving(false);}}catch{setMessage('Could not cancel before the call. Retry.');setSaving(false);}}}>Cancel before a call</button>}{!seniorOnly&&<button onClick={onReturn}>Open call workspace</button>}</div></header>
  <section className={s.filters}><div className={s.filterHeading}><div><strong>Driver filters</strong><span>Pre-filled from saved conversation answers · clear any filter to set it to “Any”</span></div><button onClick={()=>setFilters({position:'',employmentType:'',home:'',trailer:'',experienceMonths:'',sap:''})}>Clear filters</button></div><div className={s.filterGrid}>{keys.map(key=><label key={key}>{labels[key]}<select value={filters[key]} onChange={e=>change(key,e.target.value)}><option value="">Any / not specified</option>{options[key].map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label>)}</div></section>
  {urgent.length>0&&<section className={s.results}><div className={s.sectionTitle}><div><h2>Urgent companies</h2><span>{urgent.length} urgent companies shown first. Any unconfirmed fit is labeled clearly.</span></div></div><div className={s.cards}>{urgent.map(g=>renderGroup(g,!g.programs.length))}</div></section>}
  <section className={s.results}><div className={s.sectionTitle}><div><h2>Compatible companies</h2><span>{compatible.length} other compatible companies · confirmed conflicts are hidden</span></div></div>{compatible.length?<div className={s.cards}>{compatible.map(g=>renderGroup(g))}</div>:<div className={s.empty}>No other approved company currently meets all selected filters. Clear a filter or review the driver details.</div>}</section>
  {message&&<p role="status" className={s.message}>{message}</p>}
  {review.length>0&&<section className={s.results}><div className={s.sectionTitle}><div><h2>Needs verification</h2><span>{review.length} company matches have missing or unconfirmed details. They are not confirmed fits.</span></div></div><div className={s.cards}>{review.map(g=>renderGroup(g,true))}</div></section>}
  <section className={s.finish} aria-label="Finish conversation"><div><label htmlFor="finder-finish-outcome">Call outcome</label><select id="finder-finish-outcome" value={finishChoice} disabled={finishSaving} onChange={e=>{setFinishChoice(e.target.value as FinishChoice|'');setFinishMessage('');}}><option value="">Choose the actual outcome</option>{finishChoices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>{finishChoice==='callback'&&<div><label htmlFor="finder-callback">Agreed callback date and time ({callbackZone})</label><input id="finder-callback" type="datetime-local" value={callback} disabled={finishSaving} onChange={e=>setCallback(e.target.value)}/></div>}<button className={s.finishButton} disabled={finishSaving||!finishChoice||finishChoice==='callback'&&!callback} onClick={async()=>{const choice=finishChoice;if(!choice)return;setFinishSaving(true);setFinishMessage('Saving conversation and sending owner summary…');try{const outcome:CallOutcome=choice==='voicemail_left'||choice==='voicemail_unavailable'?'no_answer':choice;let callbackAt:string|null=null;if(choice==='callback'){try{callbackAt=callbackInstant(callback,callbackZone);}catch{setFinishMessage('Enter a valid callback time and time zone.');setFinishSaving(false);return;}}const error=await onFinish(outcome,callbackAt,choice==='voicemail_left'?'left':choice==='voicemail_unavailable'?'unavailable':null,filters);if(error){setFinishMessage(error);setFinishSaving(false);}}catch{setFinishMessage('Could not finish the conversation. The call remains saved; retry Finish call.');setFinishSaving(false);}}}>{finishSaving?'Finishing…':'Finish call'}</button>{finishMessage&&<p role="status" className={s.finishMessage}>{finishMessage}</p>}</section>
  <footer>Showing approved active company offers. Confirm the recorded call outcome before finishing. The owner summary email is sent after the conversation is saved.</footer>
 </main>;
}

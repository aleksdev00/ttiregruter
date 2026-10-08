import {removedCatalogCompany} from './catalog-removals.ts';
import type {Conversation,Offer,OfferMatch,DriverAnswers} from '../contracts/index.ts';
import {emptyAnswers,matchOffer} from './rules.ts';
import {guideState,projectGuideAnswer,answerStatus,guideQuestions} from './guide.ts';
import {verifiedOffer} from './playbook.ts';
import {evaluateCarrierCriteria} from './carrierCriteria.ts';
import {effectiveCatalogOffer} from '../content/carrier-catalog/ownerCatalog.ts';
export const matchingMap=guideQuestions.map(q=>({question:q.label,field:q.id,rule:['state','experienceMonths','employmentType','position'].includes(q.id)?'Base hiring requirement plus documented carrier rules':'Documented carrier requirement or preference',effect:'Confirmed hard failure excludes; missing facts require review; preference affects rank only'}));
export const matchLabels:Record<OfferMatch['state'],string>={match:'Match',potential_fit:'Potential Match',needs_confirmation:'Review Needed',not_fit:'Does Not Meet Current Rules',unavailable:'Unavailable / awaiting approval'};
export function confirmedMatchingAnswers(c:Conversation){
 if(!c.playbook?.guide)return c.answers;
 const g=guideState(c);let a:DriverAnswers={...emptyAnswers,safeToTalk:c.answers.safeToTalk,licenseClass:c.answers.licenseClass,position:c.answers.position};
 for(const [id,value] of Object.entries(g.answers))if(g.confirmed[id]&&!g.reviewReasons[id])a=projectGuideAnswer(a,id,value);
 return a;
}
export function matchConversationOffer(o:Offer,c:Conversation,now=new Date()){
 o=effectiveCatalogOffer(o);
 if(removedCatalogCompany(undefined,o.companyName))o={...o,active:false,recruitingApproved:false};
 const m=matchOffer(o,confirmedMatchingAnswers(c),now),g=guideState(c);
 if(m.state==='unavailable'){m.reasons=[o.approvalStatus&&o.approvalStatus!=='approved'?`Catalog status: ${o.approvalStatus}. Not approved for recommendation.`:'Opening inactive, expired, or recruiting not approved.'];return m;}
 // Route and home-time answers are preferences unless the catalog explicitly
 // marks the corresponding rule as hard. Never infer a hard rule from free text.
 for(const [field,conflict] of [['route','Route preference differs'],['home','Home time preference differs']] as const){if(!(o.requirements??[]).some(r=>r.field===field&&r.kind==='hard')){const i=m.conflicts.indexOf(conflict);if(i>=0){m.conflicts.splice(i,1);m.reasons.push(`${field}: preference differs; discuss the tradeoff`);}}}
 for(const rule of o.requirements??[]){
  const v=g.confirmed[rule.field]&&!g.reviewReasons[rule.field]?g.answers[rule.field]:null;
  if(!v){m.missingFacts.push(`${rule.label}: ${answerStatus(g,rule.field)} — verify before recommending`);continue;}
  const numeric=Number(v),boundary=Number(rule.values[0]);
  if(!rule.values.length||(rule.operator!=='in'&&(!rule.values[0].trim()||!Number.isFinite(boundary)))){m.missingFacts.push(`${rule.label}: carrier rule needs verification`);continue;}
  const valid=rule.operator==='in'?rule.values.includes(v):Number.isFinite(numeric)&&Number.isFinite(boundary)&&(rule.operator==='minimum'?numeric>=boundary:numeric<=boundary);
  if(valid){m.reasons.push(`${rule.label}: confirmed answer aligns`);m.preferenceScore++;}
  else if(rule.kind==='hard')m.conflicts.push(`${rule.label}: confirmed answer does not meet the carrier requirement`);
  else m.reasons.push(`${rule.label}: preference differs; discuss the tradeoff`);
 }
 evaluateCarrierCriteria(o,c,m);
 for(const id of ['position','sap','trailer','truck','payTarget','availability','dealbreakers'])if(g.confirmed[id]&&!(o.requirements??[]).some(r=>r.field===id)&&!(o.matchingCriteria&&['sap','trailer','truck','payTarget'].includes(id)))m.missingFacts.push(`${id}: ${g.answers[id]} — verify against carrier terms`);
 for(const [id,reason] of Object.entries(g.reviewReasons))m.missingFacts.push(`${id}: ${answerStatus(g,id)} (${reason})`);
 if(o.isDemo)m.missingFacts.push('Fictional offer: current carrier terms are not verified');
 else if(!verifiedOffer(o))m.missingFacts.push('Current approved written carrier terms are not verified');
 const tradeoff=m.reasons.some(reason=>reason.includes('tradeoff'));
 m.conflicts=[...new Set(m.conflicts)];m.missingFacts=[...new Set(m.missingFacts)];m.reasons=[...new Set(m.reasons)];
 m.state=m.conflicts.length?'not_fit':m.missingFacts.length?'needs_confirmation':tradeoff?'potential_fit':verifiedOffer(o)?'match':'potential_fit';
 return m;
}
export function rankedConversationOffers(offers:Offer[],c:Conversation){
 const level={match:0,potential_fit:0,needs_confirmation:1,not_fit:2,unavailable:3};
 return offers.map(offer=>({offer:effectiveCatalogOffer(offer),match:matchConversationOffer(offer,c)})).sort((a,b)=>
  Number(b.offer.urgent===true&&!['not_fit','unavailable'].includes(b.match.state))-Number(a.offer.urgent===true&&!['not_fit','unavailable'].includes(a.match.state))||
  level[a.match.state]-level[b.match.state]||
  b.match.preferenceScore-a.match.preferenceScore||a.match.missingFacts.length-b.match.missingFacts.length||a.offer.companyName.localeCompare(b.offer.companyName)||a.offer.id.localeCompare(b.offer.id));
}

// Priority can apply to a provisional workbook offer whose documented driver
// requirements align. It never clears its Review Needed state or approval gaps.
// The focused shortlist still requires documented driver fit. The persistent
// priority strip separately shows provisional candidates with verification labels.
export function documentedDriverFit(offer:Offer,c:Conversation,match=matchConversationOffer(offer,c)){
 if(['not_fit','unavailable'].includes(match.state))return false;
 if(['match','potential_fit'].includes(match.state))return true;
 const k=effectiveCatalogOffer(offer).matchingCriteria;if(!k)return false;
 const g=guideState(c),value=(id:string)=>g.confirmed[id]&&!g.reviewReasons[id]&&(!g.statuses?.[id]||g.statuses[id]==='confirmed')?g.answers[id]:undefined;
 const position=value('position'),sap=value('sap'),trailer=value('trailer'),state=value('state'),months=value('experienceMonths'),route=value('route'),home=value('home');
 if(!position||!state||!months||k.minimumExperienceMonths===null||!trailer||!k.trailers.includes(trailer)||k.trailerExperienceMonths[trailer])return false;
 if(position==='Company driver'&&(offer.employment==='unknown'||!value('employmentType')))return false;
 if(sap!=='no'&&!(sap==='completed'&&['completed_only','consider'].includes(k.sap)))return false;
 if(k.routes.length&&(!route||!k.routes.includes(route)))return false;
 const minimum=Math.max(k.minimumOutDays??0,k.stateMinimumOutDays[state]??0);
 if(minimum&&(!home||Number(home)<minimum))return false;
 if(k.excludedCities.length&&!value('locationZip'))return false;
 return true;
}
// Only approved, current offers meeting every confirmed hard requirement are
// compatible. Missing facts and pending catalog review are not compatibility.
export function compatibleConversationOffers(offers:Offer[],c:Conversation){return rankedConversationOffers(offers,c).filter(x=>x.match.state==='match'||x.match.state==='potential_fit');}
// Keep possible matches visible while key driver facts are still being collected.
// Hard conflicts and unavailable offers remain excluded from recommendations.
export function candidateConversationOffers(offers:Offer[],c:Conversation){return rankedConversationOffers(offers,c).filter(x=>x.match.state==='match'||x.match.state==='potential_fit'||x.match.state==='needs_confirmation');}
export function suitableShortlist(offers:Offer[],c:Conversation){return uniqueCompanyOffers(compatibleConversationOffers(offers,c)).slice(0,2);}
export function uniqueCompanyOffers(offers:Array<{offer:Offer;match:OfferMatch}>){
 const seen=new Set<string>();
 return offers.filter(({offer})=>{const key=offer.companyName.trim().toLocaleLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true;});
}
// Highlight at most six distinct catalog-marked Hot Seat companies, but only
// after the same compatibility checks used by the full company catalog.
export function hotSeatShortlist(offers:Offer[],c:Conversation,limit=6){
 return uniqueCompanyOffers(candidateConversationOffers(offers,c).filter(({offer,match})=>offer.urgent&&documentedDriverFit(offer,c,match))).slice(0,Math.max(0,limit));
}

// Persistent priority strip: independent of filters, pagination and call stage.
// Confirmed hard failures never appear, including any history under No SAP.
export function priorityCompanyOffers(offers:Offer[],c:Conversation){
 return uniqueCompanyOffers(candidateConversationOffers(offers,c).filter(x=>x.offer.urgent));
}

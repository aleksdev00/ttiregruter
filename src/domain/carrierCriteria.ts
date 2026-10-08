import type {Conversation,Offer,OfferMatch} from '../contracts/index.ts';
import {guideState} from './guide.ts';

export function evaluateCarrierCriteria(offer:Offer,c:Conversation,m:OfferMatch){
 const k=offer.matchingCriteria;if(!k)return;
 const g=guideState(c);
 const answer=(field:string)=>g.confirmed[field]&&!g.reviewReasons[field]&&(!g.statuses?.[field]||g.statuses[field]==='confirmed')?g.answers[field]:undefined;
 const sap=answer('sap'),trailer=answer('trailer'),truck=answer('truck'),route=answer('route'),home=answer('home'),state=answer('state')??(!c.playbook?.guide?c.answers.homeState:undefined);
 const location=answer('locationZip');
 const missing=(text:string)=>m.missingFacts.push(text);
 const conflict=(text:string)=>m.conflicts.push(text);
 const align=(text:string,weight=1)=>{m.reasons.push(text);m.preferenceScore+=weight;};
 if(!sap)missing('SAP / RTD status is not confirmed.');
 else if(!['no','completed','needsrtd'].includes(sap))missing('SAP / RTD answer requires verification.');
 else if(k.sap==='no_history'){
  if(sap!=='no')conflict('Carrier does not accept SAP history, including completed SAP / RTD.');
  else align('No SAP history meets the documented carrier policy.');
 }else if(sap!=='no'){
  if(k.sap==='completed_only'&&sap==='needsrtd')conflict('Carrier requires completed SAP / RTD; return-to-duty is not completed.');
  else if(k.sap==='unknown')missing('Carrier SAP / RTD acceptance policy is not documented.');
  else missing('Carrier considers SAP drivers; verify completion / RTD documents and individual clearance.');
 }
 if(trailer){
  if(k.excludedTrailers.includes(trailer))conflict(`Carrier does not offer the requested ${trailer} equipment.`);
  else if(k.trailers.includes(trailer))align(`Documented ${trailer} equipment aligns with the driver.`,priorityWeight(c,'equipment'));
  else missing(`${trailer} equipment is not confirmed for this program.`);
 }else missing('Driver trailer preference is not confirmed.');
 if(truck){if(k.trucks.includes(truck))align(`${truck} is documented; current assignment still requires confirmation.`,priorityWeight(c,'equipment'));else if(k.trucks.length)m.reasons.push(`Requested ${truck} differs from the listed fleet; discuss the equipment tradeoff.`);else missing(`${truck} fleet / assignment requires verification.`);}
 if(route){
  if(!k.routes.length)missing(`${route} route availability requires verification.`);
  else if(!k.routes.includes(route))conflict(`Carrier does not document a ${route} opening for this program.`);
  else align(`${route} route is documented.`,priorityWeight(c,'routes'));
 }
 if(state&&k.excludedStates.includes(state))conflict(`Carrier does not hire this program in ${state}.`);
 if(k.excludedCities.length){
  if(!location)missing(`Confirm city: restricted hiring areas include ${k.excludedCities.join(', ')}.`);
  else {const city=location.split('|')[0].trim().toLocaleLowerCase();if(k.excludedCities.some(x=>city===x.toLocaleLowerCase()))conflict(`Carrier excludes the driver's hiring city (${location.split('|')[0].trim()}).`);else missing('Confirm the driver is outside the restricted hiring metro areas.');}
 }
 const minOut=Math.max(k.minimumOutDays??0,state?k.stateMinimumOutDays[state]??0:0);
 if(home&&minOut){
  // Home answers record the maximum number of days the driver is willing out.
  if(Number(home)<minOut)conflict(`Driver wants at most ${home} days out; carrier requires at least ${minOut}.`);
  else align(`Driver's ${home}-day out preference supports the ${minOut}-day minimum.`,priorityWeight(c,'home_time'));
 }
 if(home&&!minOut){
  if(route==='Local'&&k.routes.includes('Local')&&home==='1')align('Local home-daily preference is consistent; confirm the specific account.',priorityWeight(c,'home_time'));
  else missing('Exact home-time cycle for this program needs confirmation.');
 }
 if(!state&&Object.keys(k.stateMinimumOutDays).length)missing('Residence affects the minimum time out; confirm the home state.');
 if(trailer&&k.trailerExperienceMonths[trailer]){
  const required=k.trailerExperienceMonths[trailer],total=answer('experienceMonths');
  if(total&&Number(total)<required)conflict(`${trailer} requires at least ${required} months of verifiable experience.`);
  else missing(`Verify ${required} months of ${trailer} experience separately; total CDL experience is not proof.`);
 }
 // Do not convert CPM or a revenue share to weekly take-home using invented
 // miles, deductions or guarantees. Only compare like-for-like documented pay.
 const pay=answer('payTarget');
 if(pay){const [amount,basis,period]=pay.split('|').map(x=>x.trim());
  if(basis==='gross'&&period==='weekly'&&offer.pay.unit==='weekly'&&offer.pay.max!==null){
   if(Number(amount)<=offer.pay.max)align('Weekly gross target falls within the advertised range, not a pay guarantee.',priorityWeight(c,'pay'));
   else m.reasons.push('Weekly gross target exceeds the advertised range; discuss the pay tradeoff.');
  }else missing('Verify pay target against the correct gross / take-home basis, period, miles and deductions.');
 }
 m.missingFacts.push(...k.review);
}

function priorityWeight(c:Conversation,topic:'equipment'|'routes'|'home_time'|'pay'){
 const g=guideState(c),text=g.confirmed.priority&&!g.reviewReasons.priority?(g.answers.priority??'').toLowerCase():'';
 const terms={equipment:/truck|trailer|equipment/,routes:/route|local|regional|dedicated/,home_time:/home|family|schedule/,pay:/pay|money|income|earn/};
 return c.answers.priority===topic||terms[topic].test(text)?3:1;
}

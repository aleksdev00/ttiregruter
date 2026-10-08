import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Conversation,Offer} from '../../src/contracts/index.ts';
import {emptyAnswers} from '../../src/domain/rules.ts';
import {emptyPlaybookState} from '../../src/contracts/playbook.ts';
import {ownerCatalog,effectiveCatalogOffer} from '../../src/content/carrier-catalog/ownerCatalog.ts';
import {ownerMatchingCriteria} from '../../src/content/carrier-catalog/ownerCriteria.ts';
import {candidateConversationOffers,matchConversationOffer,rankedConversationOffers,suitableShortlist,hotSeatShortlist,priorityCompanyOffers} from '../../src/domain/offerMatching.ts';
import {validateSnapshot} from '../../src/adapters/demo/validation.ts';
import {seed} from '../../src/adapters/demo/seed.ts';

function conversation(patch:Record<string,string>={}):Conversation{
 const answers={position:'Company driver',employmentType:'1099',state:'IL',experienceMonths:'36',sap:'no',trailer:'Dry van',home:'28',route:'OTR',...patch};
 return {id:'fixture-conversation',contactId:'fixture-driver',recruiterId:'fixture-recruiter',status:'active',activeStepId:'offer',answers:{...emptyAnswers,position:'company',employment:'1099',homeState:answers.state,licenseClass:'A',experienceMonths:Number(answers.experienceMonths)},selectedOfferId:null,startedAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z',closedAt:null,outcome:null,scriptVersion:'fixture',offerSnapshotVersion:'fixture',revision:1,playbook:{...structuredClone(emptyPlaybookState),guide:{answers,confirmed:Object.fromEntries(Object.keys(answers).map(id=>[id,true])),reviewReasons:{},lastAnswered:'state'}}};
}
function carrier(id:string,program='company'){
 const record=ownerCatalog.find(x=>x.id===id)!;
 return record.drafts.find(x=>x.documentedTerms?.program===program)??record.drafts[0];
}

test('All 31 workbook carriers and all program drafts have sourced, validated criteria',()=>{
 const offers=ownerCatalog.flatMap(x=>x.drafts);
 assert.equal(new Set(ownerCatalog.map(x=>x.id)).size,31);
 for(const o of offers){assert.ok(o.matchingCriteria?.source);assert.equal(o.minExperienceMonths,o.matchingCriteria!.minimumExperienceMonths);}
 const saved=validateSnapshot({...seed(),offers});assert.deepEqual(saved.offers,offers);
});

test('Every explicit No SAP carrier excludes completed SAP and incomplete RTD, including when urgent',()=>{
 const ids=['all-48-freight','argo-transport','green-parrot','next-unlimited','nis-express','ma-men-carriers','tiger-limited','tsi-logistics','tzar-freight','filmar-logistics'];
 for(const id of ids)for(const sap of ['completed','needsrtd']){
  const o={...carrier(id),urgent:true},c=conversation({sap});
  assert.equal(matchConversationOffer(o,c).state,'not_fit',id);
  assert.match(matchConversationOffer(o,c).conflicts.join(' '),/does not accept SAP/);
  assert.equal(candidateConversationOffers([o],c).length,0);
 }
});

test('Completed-only SAP, conditional acceptance and unknown policies remain distinct',()=>{
 for(const id of ['sharp-one','novas-express']){
  assert.equal(matchConversationOffer(carrier(id),conversation({sap:'needsrtd'})).state,'not_fit');
  const m=matchConversationOffer(carrier(id),conversation({sap:'completed'}));assert.equal(m.state,'needs_confirmation');assert.equal(m.conflicts.length,0);assert.match(m.missingFacts.join(' '),/documents|documentation/);
 }
 for(const id of ['bbcl','chi-logistics','final-target'])assert.equal(matchConversationOffer(carrier(id),conversation({sap:'completed'})).conflicts.length,0,id);
 for(const id of ['ay-trucking','blue-eyes','yankee-freight']){const m=matchConversationOffer(carrier(id),conversation({sap:'completed',trailer:id==='blue-eyes'?'Flatbed':'Dry van'}));assert.match(m.missingFacts.join(' '),/SAP \/ RTD acceptance policy is not documented/);assert.ok(!m.conflicts.some(x=>x.includes('does not accept SAP')),id);}
 for(const id of ['nis-express','bbcl','novas-express'])assert.equal(carrier(id,'owner_operator').matchingCriteria!.sap,'unknown');
});

test('Experience reflects carrier and program conditions without inventing blanket cutoffs',()=>{
 for(const [id,minimum] of [['gt-express',3],['db-transport',12],['cia-transport',18],['denver-cargo',24],['luka-transportation',24]] as const){
  const o=carrier(id),trailer=id==='cia-transport'?'Flatbed':'Dry van';
  assert.equal(o.minExperienceMonths,minimum);
  assert.ok(matchConversationOffer(o,conversation({experienceMonths:String(minimum-1),trailer})).conflicts.some(x=>x.includes('months of experience')));
  assert.ok(!matchConversationOffer(o,conversation({experienceMonths:String(minimum),trailer})).conflicts.some(x=>x.includes('months of experience')));
 }
 assert.equal(carrier('chi-logistics').minExperienceMonths,0);
 assert.equal(carrier('chi-logistics','lease').minExperienceMonths,null);
 assert.equal(carrier('bbcl','lease').minExperienceMonths,null);
 assert.equal(matchConversationOffer(carrier('novas-express'),conversation({trailer:'Flatbed',experienceMonths:'11'})).state,'not_fit');
 assert.match(matchConversationOffer(carrier('novas-express'),conversation({trailer:'Flatbed',experienceMonths:'12'})).missingFacts.join(' '),/Flatbed experience separately/);
 assert.equal(carrier('novas-express').minExperienceMonths,null);
});

test('Equipment, hiring exclusions, cities and state-specific out-time filter live confirmed answers',()=>{
 assert.equal(matchConversationOffer(carrier('nis-express'),conversation({state:'CA'})).state,'not_fit');
 assert.equal(matchConversationOffer(carrier('green-parrot'),conversation({state:'FL'})).state,'not_fit');
 assert.equal(matchConversationOffer(carrier('nis-express'),conversation({trailer:'Reefer'})).state,'not_fit');
 assert.equal(matchConversationOffer(carrier('luka-transportation'),conversation({home:'21',state:'FL'})).state,'not_fit');
 assert.equal(matchConversationOffer(carrier('luka-transportation'),conversation({home:'28',state:'FL'})).conflicts.length,0);
 assert.equal(matchConversationOffer(carrier('final-target'),conversation({locationZip:'Memphis | 38118'})).state,'not_fit');
 assert.equal(matchConversationOffer(carrier('tzar-freight'),conversation({home:'14'})).state,'not_fit');
 assert.equal(matchConversationOffer(carrier('all-48-freight'),conversation({route:'Local',trailer:'Conestoga'})).state,'not_fit');
 assert.match(matchConversationOffer(carrier('hub-group-local'),conversation({route:'Local',home:'1',locationZip:'Warrenville | 60555'})).missingFacts.join(' '),/measured distance of 50 miles/);
});

test('Unknown and unconfirmed answers never masquerade as confirmed requirements',()=>{
 const c=conversation({sap:'completed'});c.playbook!.guide!.confirmed.sap=false;c.playbook!.guide!.reviewReasons.sap='Awaiting Clearinghouse record';
 const m=matchConversationOffer(carrier('nis-express'),c);assert.equal(m.state,'needs_confirmation');assert.equal(m.conflicts.length,0);assert.match(m.missingFacts.join(' '),/not confirmed/);
});

test('Original live workbook rows are enriched identically on server and client; manual revisions remain intact',()=>{
 const current=carrier('nis-express');const {matchingCriteria,...old}=current;
 const oldRow={...old,requirements:[{field:'sap' as const,kind:'hard' as const,operator:'in' as const,values:['no'],label:'Old SAP rule'}]};
 const resolved=effectiveCatalogOffer(oldRow);assert.deepEqual(resolved.matchingCriteria,matchingCriteria);assert.equal(resolved.id,oldRow.id);assert.equal(resolved.snapshotVersion,oldRow.snapshotVersion);
 assert.equal(matchConversationOffer(oldRow,conversation({sap:'completed'})).state,'not_fit');
 const manual={...oldRow,snapshotVersion:'2',requirements:[]};assert.equal(effectiveCatalogOffer(manual),manual);
});

function verified(id:string,urgent=false):Offer{
 return {...seed().offers[0],id,companyName:id,urgent,isDemo:false,source:'approved_snapshot',employment:'1099',approvalStatus:'approved',recruitingApproved:true,verifiedAt:'2026-01-01T00:00:00Z',hiringStates:['IL'],minExperienceMonths:12,requiredLicense:'A',routeType:'otr',homeTime:'flexible',requirements:['position','sap','trailer','truck','payTarget','availability','dealbreakers'].map(field=>({field:field as NonNullable<Offer['requirements']>[number]['field'],kind:'hard',operator:'in',values:[field==='position'?'Company driver':'accepted'],label:field}))};
}
test('Compatible urgent companies rank first, priority candidates keep verification labels, and shortlist is two distinct companies',()=>{
 const c=conversation({sap:'accepted',trailer:'accepted',truck:'accepted',payTarget:'accepted',availability:'accepted',dealbreakers:'accepted'}),regular=verified('Regular'),urgent=verified('Urgent',true),unknown={...verified('Unknown',true),hiringStates:null};
 const ranked=rankedConversationOffers([regular,unknown,urgent,{...urgent,id:'second-program'}],c);
 assert.equal(ranked[0].offer.companyName,'Urgent');assert.equal(ranked.at(-1)!.offer.companyName,'Regular');assert.equal(ranked.find(x=>x.offer.companyName==='Unknown')!.match.state,'needs_confirmation');
 assert.deepEqual(suitableShortlist(ranked.map(x=>x.offer),c).map(x=>x.offer.companyName),['Urgent','Regular']);
 const incompatible={...urgent,requirements:[{field:'sap' as const,kind:'hard' as const,operator:'in' as const,values:['no'],label:'No SAP'}]};assert.equal(candidateConversationOffers([incompatible],c).length,0);
});

test('Changing a confirmed preference reranks documented fleet alignment without treating a truck preference as a ban',()=>{
 const c=conversation({truck:'Freightliner'}),a=carrier('ay-trucking'),b=carrier('next-unlimited');
 const before=matchConversationOffer(a,c).preferenceScore;c.playbook!.guide!.answers.truck='Volvo';
 assert.ok(matchConversationOffer(a,c).preferenceScore<before);assert.ok(matchConversationOffer(b,c).reasons.some(x=>x.includes('Volvo')));assert.equal(matchConversationOffer(a,c).conflicts.length,0);
 assert.equal(ownerMatchingCriteria('steel-fleet','owner_operator').sap,'unknown');
});

test('Urgent workbook candidates gain priority only when documented driver requirements align; review gaps remain explicit',()=>{
 const c=conversation(),urgent={...carrier('nis-express'),urgent:true},regular=carrier('tzar-freight');
 const ranked=rankedConversationOffers([regular,urgent],c);assert.equal(ranked[0].offer.id,urgent.id);assert.equal(ranked[0].match.state,'needs_confirmation');assert.ok(ranked[0].match.missingFacts.length);
 assert.equal(hotSeatShortlist([urgent],c).length,1);
 c.playbook!.guide!.answers.sap='completed';assert.equal(hotSeatShortlist([urgent],c).length,0);assert.equal(candidateConversationOffers([urgent],c).length,0);
 const unknownPolicy={...carrier('yankee-freight'),urgent:true};assert.equal(hotSeatShortlist([unknownPolicy],c).length,0);
});


test('Persistent urgent list is unbounded, available before qualification, and excludes SAP hard failures live',()=>{
 const c=conversation(),offers=Array.from({length:8},(_,i)=>({...carrier('nis-express'),id:`urgent-${i}`,companyName:`Urgent ${i}`,urgent:true}));
 c.playbook!.guide!.confirmed={};assert.equal(priorityCompanyOffers(offers,c).length,8);
 c.playbook!.guide!.confirmed={sap:true};c.playbook!.guide!.answers.sap='completed';assert.equal(priorityCompanyOffers(offers,c).length,0);
 c.playbook!.guide!.answers.sap='needsrtd';assert.equal(priorityCompanyOffers(offers,c).length,0);
 c.playbook!.guide!.answers.sap='no';assert.equal(priorityCompanyOffers(offers,c).length,8);
});

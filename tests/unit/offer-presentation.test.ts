import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ownerCatalog} from '../../src/content/carrier-catalog/ownerCatalog.ts';
import {offerPresentation} from '../../src/domain/offer-presentation.ts';

test('all imported programs display their complete documented terms despite missing structured fields',()=>{
 for(const offer of ownerCatalog.flatMap(c=>c.drafts)){
  const before=JSON.stringify(offer),view=offerPresentation(offer);
  assert.equal(view.rows[0].value,offer.documentedTerms!.summary);
  assert.equal(view.rows[1].value,offer.documentedTerms!.schedule);
  assert.equal(view.rows[2].value,offer.documentedTerms!.equipment);
  assert.doesNotMatch(view.rows.map(r=>r.value).join(' '),/\[[^\]]+\]/);
  assert.equal(view.status,'Catalog terms · current opening needs verification');
  assert.equal(JSON.stringify(offer),before);
 }
});

test('company changes use the new company terms and keep missing classification separate',()=>{
 const nis=ownerCatalog.find(c=>c.id==='nis-express')!.drafts[0];
 const yankee=ownerCatalog.find(c=>c.id==='yankee-freight')!.drafts[0];
 assert.notEqual(offerPresentation(nis).rows[0].value,offerPresentation(yankee).rows[0].value);
 const unclassified=ownerCatalog.find(c=>c.id==='ufc')!.drafts[0];
 const view=offerPresentation(unclassified);
 assert.ok(view.verification.includes('W-2/1099 classification'));
 assert.equal(view.rows[0].value,unclassified.documentedTerms!.summary);
});

test('missing terms produce specific requests for confirmation without made-up terms',()=>{
 const offer={...ownerCatalog[0].drafts[0],documentedTerms:undefined,routeType:null,homeTime:null,pay:{...ownerCatalog[0].drafts[0].pay,note:''}};
 const view=offerPresentation(offer);
 assert.match(view.rows[0].value,/Confirm the current pay/);
 assert.match(view.rows[1].value,/Confirm the route/);
 assert.match(view.rows[2].value,/Confirm the available equipment/);
});

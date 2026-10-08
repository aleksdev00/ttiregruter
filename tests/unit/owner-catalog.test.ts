import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogCounts,ownerCatalog,ownerCatalogSource} from '../../src/content/carrier-catalog/ownerCatalog.ts';

test('owner workbook intake includes all 31 carrier sheets with stable provenance',()=>{
 assert.equal(ownerCatalog.length,31);
 assert.equal(new Set(ownerCatalog.map(record=>record.id)).size,31);
 assert.equal(ownerCatalogSource.sha256,'da3ac82422922f0e858e85ecba0490b7d3808fc899a200c1b1f22641218c9a71');
 assert.ok(catalogCounts().reviewableDrafts>=catalogCounts().explicitPrograms);
});

test('owner workbook drafts are non-demo, inactive, pending review and never recruiting approved',()=>{
 const drafts=ownerCatalog.flatMap(record=>record.drafts);
 assert.ok(drafts.length>0);
 for(const offer of drafts){
  assert.equal(offer.isDemo,false);
  assert.equal(offer.active,false);
  assert.equal(offer.approvalStatus,'pending_review');
  assert.equal(offer.recruitingApproved,false);
  assert.equal(offer.verifiedAt,null);
  assert.equal(offer.expiresAt,null);
  assert.equal(offer.source,'google_sheet');
 }
});

test('qualified workbook notes remain verification gaps instead of guaranteed terms',()=>{
 const bbcl=ownerCatalog.find(record=>record.id==='bbcl')!;
 const yankee=ownerCatalog.find(record=>record.id==='yankee-freight')!;
 const wfc=ownerCatalog.find(record=>record.id==='wfc-freight')!;
 assert.match(bbcl.verificationNotes.join(' '),/under two years is review only/i);
 assert.match(yankee.verificationNotes.join(' '),/historical lease maintenance/i);
 assert.match(wfc.verificationNotes.join(' '),/2027 equipment is not guaranteed/i);
 assert.equal(ownerCatalog.find(record=>record.id==='ufc')!.drafts[0].employment,'unknown');
});

test('obsolete carrier application URLs are not imported',()=>{
 const serialized=JSON.stringify(ownerCatalog);
 assert.doesNotMatch(serialized,/driverapponline|intelliapp|growthco/i);
});

test('Every carrier has a browsable documented program without inventing tax classification or current inventory',()=>{
 for(const company of ownerCatalog){assert.ok(company.drafts.length);for(const offer of company.drafts){assert.ok(offer.documentedTerms?.source.includes(ownerCatalogSource.sha256));assert.doesNotMatch(offer.documentedTerms!.summary,/\[[^\]]+\]/);}}
 assert.equal(ownerCatalog.find(c=>c.id==='green-parrot')!.drafts[0].employment,'unknown');
 assert.equal(ownerCatalog.find(c=>c.id==='nis-express')!.drafts.find(o=>o.documentedTerms?.program==='company')!.employment,'1099');
 const filmar=ownerCatalog.find(c=>c.id==='filmar-logistics')!;assert.deepEqual(filmar.drafts.map(o=>o.employment),['owner_operator']);
 const c2b=ownerCatalog.find(c=>c.id==='c2b-cargo')!.drafts[0];assert.match(c2b.documentedTerms!.deductions.join(' '),/conflict/);
});

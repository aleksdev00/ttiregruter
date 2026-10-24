import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkbookOfferDrafts} from '../../src/domain/company-workbook.ts';

test('workbook preview identifies new companies and keeps existing catalog entries read-only',()=>{
 const result=buildWorkbookOfferDrafts([
  {name:'New Carrier',rows:[['Offer'],['Program','Company driver W-2'],['Pay','$0.65-$0.72 CPM'],['Schedule','OTR, 3 weeks out'],['Trailer','Dry van'],['SAP policy','Completed SAP only']]},
  {name:'Already Listed',rows:[['Pay','$0.60 CPM']]},
 ],['already listed']);
 assert.equal(result.length,2);
 assert.equal(result[0].name,'New Carrier');
 assert.equal(result[0].existing,false);
 assert.equal(result[0].program,'company');
 assert.equal(result[0].employment,'w2');
 assert.equal(result[0].payUnit,'cpm');
 assert.equal(result[0].payMin,0.65);
 assert.equal(result[0].payMax,0.72);
 assert.equal(result[0].schedule,'Schedule: OTR, 3 weeks out');
 assert.equal(result[0].equipment,'Trailer: Dry van');
 assert.equal(result[0].sap,'completed_only');
 assert.equal(result[1].existing,true);
});

test('company rows with the same normalized name are consolidated across worksheets',()=>{
 const result=buildWorkbookOfferDrafts([
  {name:'North Star',rows:[['Company Name','North Star Freight'],['Pay','$0.70 CPM']]},
  {name:'Details',rows:[['Carrier','north star freight'],['Trailer','Flatbed']]},
 ],[]);
 assert.equal(result.length,1);
 assert.match(result[0].name,/North Star Freight/i);
 assert.match(result[0].summary,/Pay: \$0.70 CPM/);
 assert.match(result[0].summary,/Trailer: Flatbed/);
 assert.equal(result[0].sheet,'North Star, Details');
});

test('company table worksheets read columns and merge repeated carrier rows',()=>{
 const [entry]=buildWorkbookOfferDrafts([{name:'Offers',rows:[
  ['Company Name','Pay','Schedule','Trailer'],
  ['Road Star','$0.68 CPM','OTR · 3 weeks out','Dry van'],
  ['Road Star','$0.72 CPM','Regional · weekly home','Reefer'],
 ]}],[]);
 assert.equal(entry.name,'Road Star');
 assert.match(entry.summary,/OTR · 3 weeks out/);
 assert.match(entry.summary,/Regional · weekly home/);
 assert.equal(entry.payMin,0.68);
 assert.equal(entry.payMax,0.72);
 assert.equal(entry.schedule,'Schedule: OTR · 3 weeks out\nSchedule: Regional · weekly home');
 assert.equal(entry.equipment,'Trailer: Dry van\nTrailer: Reefer');
});

test('unverified terms never imply verified hiring or a pay guarantee',()=>{
 const [entry]=buildWorkbookOfferDrafts([{name:'Example Carrier',rows:[['Pay','$0.50-$0.60 CPM'],['Hiring','Now']]}],[]);
 assert.equal(entry.existing,false);
 assert.equal(entry.employment,'unknown');
 assert.equal(entry.payUnit,'cpm');
 assert.equal(entry.sap,'unknown');
 assert.equal(entry.schedule,'Needs verification.');
});

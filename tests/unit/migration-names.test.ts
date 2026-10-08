import test from 'node:test';
import assert from 'node:assert/strict';
import {reliableImportedName,mapLegacyContacts,LEGACY_SOURCE} from '../../src/server/contact-migration.ts';
import {displayName,greetingName,emptyAnswers} from '../../src/domain/rules.ts';
test('Imported names retain real names and preserve availability text only in original data',()=>{
 for(const name of ['John','Smith','Weeks','May','Aleksa Cvetanović',"O’Neill",'Anne-Marie'])assert.equal(reliableImportedName(name),name);
 for(const name of ['Starts In Two Weeks','Starts','In Two Weeks','ASAP','Dry Van','combined-12345'])assert.equal(reliableImportedName(name),null);
 const row={id:'name-test',first_name:'Starts',last_name:'In Two Weeks',phone_e164:'+12025550101',lead_status:'new'};
 const mapped=mapLegacyContacts({schemaVersion:1,sourceProjectId:LEGACY_SOURCE,extractedAt:new Date().toISOString(),driver_profiles:[row],owner_operator_contacts:[],recruiters:[],contact_batches:[],contact_batch_items:[]},[]).items[0].contact;
 assert.equal(mapped.firstName,null);assert.equal(mapped.lastName,null);assert.equal(mapped.nameEvidence,'unknown');assert.equal(mapped.rawFields.legacy_record_json,JSON.stringify(row));
 const caller={...mapped,firstName:'WIRELESS',lastName:'CALLER',nameEvidence:'explicit_source' as const};
 assert.equal(displayName(caller),'Name not recorded');assert.equal(greetingName(caller,emptyAnswers),null);
 assert.equal(displayName(mapped),'Name not recorded');
 assert.equal(displayName({...caller,firstName:'John',lastName:'Weeks'}),'John Weeks');
});

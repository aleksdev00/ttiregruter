import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseCSV,contactCSVManifest} from '../../src/server/contact-csv.ts';
import {mapLegacyContacts} from '../../src/server/contact-migration.ts';
test('CSV handles quotes and multiline notes and preserves exact recruiter email and DNC',async()=>{
 const text='first_name,last_name,phone,notes,recruiter_email,status\r\nTest,Driver,2025550111,"First line\nSecond, ""quoted"" line",verified@fixture.invalid,do_not_contact';
 const m=await contactCSVManifest(text,'contacts.csv');assert.equal(m.driver_profiles.length,1);assert.equal(m.driver_profiles[0].notes,'First line\nSecond, "quoted" line');const mapped=mapLegacyContacts(m,[{id:'verified',email:'verified@fixture.invalid',active:1,data_json:'{}'}]).items[0];assert.equal(mapped.contact.ownerRecruiterId,'verified');assert.equal(mapped.blocked,1);assert.equal(mapped.contact.lastName,'Driver');assert.equal(mapped.contact.status,'do_not_contact');assert.equal((await contactCSVManifest(text,'contacts.csv')).driver_profiles[0].id,m.driver_profiles[0].id);
});
test('CSV skips repeated phones, preserves most restrictive row and holds ambiguous identities',async()=>{
 const m=await contactCSVManifest('name,phone,status\nTest Driver,2025550111,new\nTest Driver,+12025550111,do_not_contact\nDifferent Person,2025550112,new\nAnother Person,2025550112,new\nNo Phone,invalid,new','contacts.csv');assert.equal(m.driver_profiles.length,1);assert.equal(m.driver_profiles[0].contact_blocked,true);assert.equal(m.review!.summary.csvDuplicatesSkipped,1);assert.equal(m.review!.summary.csvAmbiguousSkipped,2);assert.equal(m.review!.summary.csvInvalidSkipped,1);
});
test('CSV rejects malformed files and missing phone header without inventing values',async()=>{assert.throws(()=>parseCSV('name,phone\n"bad,2025550111'),/Unclosed/);await assert.rejects(contactCSVManifest('name,email\nTest,example@fixture.invalid','contacts.csv'),/phone column/);await assert.rejects(contactCSVManifest('phone,name\n2025550111,Test,Unexpected','contacts.csv'),/number of columns/);});

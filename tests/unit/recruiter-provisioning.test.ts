import test from 'node:test';
import assert from 'node:assert/strict';
import {existingRecruiter} from '../../scripts/lib/recruiter-identity.mjs';
const email='synthetic@example.invalid';
test('provisioning preserves existing admin, owner and recruiter roles and original identifiers',()=>{
 for(const role of ['admin','owner','recruiter']){
  const row=Object.freeze({id:'existing-identity',email,role,active:1,data_json:'{"alias":"Synthetic"}'});
  assert.equal(existingRecruiter([row],email),row);
  assert.equal(row.role,role);assert.equal(row.id,'existing-identity');assert.equal(row.data_json,'{"alias":"Synthetic"}');
 }
});
test('provisioning denies missing, ambiguous, disabled, mismatched and invalid-role identities',()=>{
 const row={id:'existing-identity',email,role:'admin',active:1};
 for(const rows of [[],[row,row],[{...row,active:0}],[{...row,email:'different@example.invalid'}],[{...row,role:'superuser'}]])assert.throws(()=>existingRecruiter(rows,email),/Resolve the existing recruiter identity/);
});

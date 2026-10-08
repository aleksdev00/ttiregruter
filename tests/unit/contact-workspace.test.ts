import test from 'node:test';
import assert from 'node:assert/strict';
import {seed} from '../../src/adapters/demo/seed.ts';
import {contactWorkspaceContext} from '../../src/domain/contact-workspace.ts';
import {currentCallScript} from '../../src/content/playbook/engine.ts';

test('Real assigned driver opens an opening script without changing status or recording a call',()=>{
 const snapshot=seed(),contact=snapshot.contacts[0];
 snapshot.recruiter.alias='Alex Jones';contact.firstName='Balwinder';contact.lastName='Singh';contact.nameEvidence='explicit_source';contact.status='closed';contact.ownerRecruiterId=snapshot.recruiter.id;
 const before=JSON.stringify(snapshot),conversation=contactWorkspaceContext(snapshot,contact.id)!;
 assert.equal(conversation.activeStepId,'opening');assert.equal(conversation.contactId,contact.id);
 const spoken=currentCallScript({contact,conversation,recruiter:snapshot.recruiter}).text;
 assert.match(spoken,/Balwinder/);assert.match(spoken,/Alex Jones/);
 assert.equal(JSON.stringify(snapshot),before);
 contact.status='do_not_contact';assert.equal(contactWorkspaceContext(snapshot,contact.id)?.activeStepId,'opening');assert.equal(contact.status,'do_not_contact');
 contact.ownerRecruiterId='another-recruiter';assert.equal(contactWorkspaceContext(snapshot,contact.id),null);
 assert.equal(contactWorkspaceContext(snapshot,'missing-contact'),null);
});

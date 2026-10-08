import test from 'node:test';import assert from 'node:assert/strict';
import {seed} from '../../src/adapters/demo/seed.ts';
import {assignedContactView,contactReadyToCall,contactStatusLabel} from '../../src/domain/contact-list.ts';
test('Assigned view exposes imported review and restricted contacts without admitting them to the calling queue',()=>{
 const snapshot=seed(),base=snapshot.contacts[0];snapshot.conversations=[];
 snapshot.contacts=[{...base,id:'review',ownerRecruiterId:snapshot.recruiter.id,status:'closed',rawFields:{lead_status:'needs_review'}},{...base,id:'restricted',ownerRecruiterId:snapshot.recruiter.id,status:'do_not_contact'},{...base,id:'ready',ownerRecruiterId:snapshot.recruiter.id,status:'available'},{...base,id:'other-owner',ownerRecruiterId:'other-recruiter',status:'closed'}];
 assert.deepEqual(assignedContactView(snapshot,'assigned').map(c=>c.id),['review','restricted','ready']);
 assert.deepEqual(assignedContactView(snapshot,'available').map(c=>c.id),['ready']);
 assert.equal(contactReadyToCall(snapshot.contacts[0]),false);assert.equal(contactReadyToCall(snapshot.contacts[1]),false);
 assert.equal(contactStatusLabel(snapshot.contacts[0],snapshot),'Needs call-status review');assert.equal(snapshot.contacts[0].status,'closed');
 assert.deepEqual(assignedContactView(snapshot,'history'),[]);
});

test('Personal saved contacts have their own My contacts view, retain queue eligibility and never enter Assigned contacts',()=>{
 const snapshot=seed(),base=snapshot.contacts[0],owner=snapshot.recruiter.id;snapshot.conversations=[];
 snapshot.contacts=[{...base,id:'assigned',ownerRecruiterId:owner,rawFields:{},status:'available'},{...base,id:'personal',ownerRecruiterId:owner,rawFields:{myContactRecruiterId:owner},status:'available'},{...base,id:'restricted-personal',ownerRecruiterId:owner,rawFields:{myContactRecruiterId:owner},status:'do_not_contact'},{...base,id:'reassigned',ownerRecruiterId:owner,rawFields:{myContactRecruiterId:'previous-owner'},status:'available'}];
 assert.deepEqual(assignedContactView(snapshot,'assigned').map(c=>c.id),['assigned','reassigned']);
 assert.deepEqual(assignedContactView(snapshot,'mine').map(c=>c.id),['personal','restricted-personal']);
 assert.deepEqual(assignedContactView(snapshot,'available').map(c=>c.id),['assigned','personal','reassigned']);
});

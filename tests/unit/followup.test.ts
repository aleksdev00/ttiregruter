import {test} from 'node:test';import assert from 'node:assert/strict';
import {conversationFollowup} from '../../src/domain/followup.ts';
import {nextAvailableContact} from '../../src/domain/contact-list.ts';
import {seed} from '../../src/adapters/demo/seed.ts';
import type {Conversation} from '../../src/contracts/index.ts';
test('All unfinished outcomes produce a task with no fabricated appointment',()=>{
 for(const outcome of ['interested','qualification_in_progress','pending_verification','company_chosen','handoff_required','no_current_fit'] as const){
 const task=conversationFollowup({id:'conv',status:'closed',outcome} as Conversation);
 assert.ok(task);assert.equal(task.dueAt,null);assert.equal(task.data.conversationId,'conv');assert.ok(task.data.nextAction);
 }
 for(const outcome of ['not_interested','wrong_number','do_not_contact','no_answer','application_received'] as const)assert.equal(conversationFollowup({status:'closed',outcome} as Conversation),null);
 assert.equal(conversationFollowup({status:'active',outcome:'interested'} as Conversation),null);
});
test('Next contact selection uses refreshed eligibility, ownership, reservations and callback time',()=>{
 const snapshot=seed(),base=snapshot.contacts[0],now=new Date('2030-01-01T00:00:00Z');
 snapshot.contacts=[{...base,id:'finished',status:'closed'},{...base,id:'other-owner',status:'available',ownerRecruiterId:'other'},{...base,id:'reserved',status:'available',ownerRecruiterId:snapshot.recruiter.id,reservedBy:'other'},{...base,id:'later',status:'callback_due',callbackAt:'2031-01-01T00:00:00Z'},{...base,id:'next',status:'available',phoneNormalized:'+12025550111',ownerRecruiterId:snapshot.recruiter.id,reservedBy:null}];
 assert.equal(nextAvailableContact(snapshot,'finished',now)?.id,'next');snapshot.contacts.pop();assert.equal(nextAvailableContact(snapshot,'finished',now),undefined);
});
import {confirmedSnapshot} from '../../src/domain/operation.ts';
test('Navigation receives refreshed data only after successful persistence and load',async()=>{
 const order:string[]=[];
 const result=await confirmedSnapshot(async()=>{order.push('save');return {ok:true,value:'old'};},async()=>{order.push('load');return {ok:true,value:'refreshed'};});
 if(result.ok)order.push('navigate:'+result.value);
 assert.deepEqual(order,['save','load','navigate:refreshed']);
 const failed=await confirmedSnapshot(async()=>({ok:true,value:'saved'}),async()=>({ok:false,code:'storage_failed',message:'Load failed'}));
 assert.equal(failed.ok,false);
});
test('Lost completion acknowledgements reconcile only the intended persisted outcome',async()=>{
 const uncertain=async()=>({ok:false as const,code:'storage_failed' as const,message:'Lost acknowledgement'});
 assert.deepEqual(await confirmedSnapshot(uncertain,async()=>({ok:true,value:'closed:callback'}),s=>s==='closed:callback'),{ok:true,value:'closed:callback'});
 assert.equal((await confirmedSnapshot(uncertain,async()=>({ok:true,value:'active'}),s=>s==='closed:callback')).ok,false);
 assert.equal((await confirmedSnapshot(async()=>new Promise(()=>{}),async()=>({ok:true,value:'closed:callback'}),s=>s==='closed:callback',5)).ok,true);
 let loads=0;
 assert.equal((await confirmedSnapshot(async()=>({ok:false,code:'invalid_input',message:'Invalid outcome'}),async()=>{loads++;return {ok:true,value:'closed:callback'};},()=>true)).ok,false);assert.equal(loads,0);
});

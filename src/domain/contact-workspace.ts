import type {AppSnapshot,Conversation} from '../contracts/index.ts';
import {emptyAnswers} from './rules.ts';
import {emptyPlaybookState} from '../contracts/playbook.ts';
import {emptyFlow} from './conversation.ts';

// A read-only opening context for a real contact, never a saved call or fixture.
export function contactWorkspaceContext(snapshot:AppSnapshot,contactId:string):Conversation|null {
 const contact=snapshot.contacts.find(c=>c.id===contactId&&(!c.ownerRecruiterId||c.ownerRecruiterId===snapshot.recruiter.id));
 if(!contact)return null;
 return {id:contactId,contactId,recruiterId:snapshot.recruiter.id,status:'active',activeStepId:'opening',answers:{...emptyAnswers},selectedOfferId:null,startedAt:'',updatedAt:'',closedAt:null,outcome:null,scriptVersion:'2026-09-30-playbook-guide-v2',offerSnapshotVersion:'',revision:0,playbook:{...structuredClone(emptyPlaybookState),flow:structuredClone(emptyFlow)}};
}

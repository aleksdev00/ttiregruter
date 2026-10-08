import type {AppSnapshot,Contact} from '../contracts/index.ts';
export type ContactView='assigned'|'mine'|'available'|'callbacks'|'history';
export function contactReadyToCall(c:Contact,now=new Date()):boolean {
 return !c.rawFields.demoRemovedAt&&(c.status==='available'||c.status==='callback_due'&&!!c.callbackAt&&new Date(c.callbackAt)<=now);
}
export function assignedContactView(snapshot:AppSnapshot,view:ContactView,now=new Date()):Contact[]{
 const owned=snapshot.contacts.filter(c=>!c.rawFields.demoRemovedAt&&(!c.ownerRecruiterId||c.ownerRecruiterId===snapshot.recruiter.id));
 const personal=(c:Contact)=>c.rawFields.myContactRecruiterId===snapshot.recruiter.id;
 if(view==='assigned')return owned.filter(c=>!personal(c));
 if(view==='mine')return owned.filter(personal);
 if(view==='available')return owned.filter(c=>contactReadyToCall(c,now));
 if(view==='callbacks')return owned.filter(c=>c.status==='callback_due');
 return owned.filter(c=>snapshot.conversations.some(x=>x.contactId===c.id&&['closed','cancelled'].includes(x.status)));
}
export function nextAvailableContact(snapshot:AppSnapshot,excludeId:string,now=new Date()):Contact|undefined {
 return snapshot.contacts.find(c=>c.id!==excludeId&&contactReadyToCall(c,now)&&!!c.phoneNormalized&&(!c.ownerRecruiterId||c.ownerRecruiterId===snapshot.recruiter.id)&&(!c.reservedBy||c.reservedBy===snapshot.recruiter.id));
}
export function contactStatusLabel(c:Contact,snapshot:AppSnapshot):string{
 if(c.status==='closed'&&c.rawFields.lead_status==='needs_review'&&!snapshot.conversations.some(x=>x.contactId===c.id&&x.status==='closed'))return 'Needs call-status review';
 return c.status.replaceAll('_',' ');
}

import type {Contact} from '../../contracts/index.ts';
// User-requested fictional contacts. Reserved fictional numbers; no real leads.
export function extraTestContacts(ownerRecruiterId:string):Contact[]{
 const people=[['Daniel','Carter','Chicago','IL'],['Michael','Turner','Indianapolis','IN'],['David','Harris','Dallas','TX'],['Chris','Walker','Columbus','OH'],['Kevin','Lewis','Atlanta','GA'],['Brian','Mitchell','Phoenix','AZ'],['Jason','Parker','Charlotte','NC'],['Ryan','Cooper','Nashville','TN'],['Eric','Bennett','Jacksonville','FL'],['Adam','Brooks','Denver','CO'],['Scott','Morgan','Kansas City','MO'],['Justin','Reed','Louisville','KY'],['Aaron','Hayes','Milwaukee','WI'],['Mark','Foster','Pittsburgh','PA'],['Tyler','Simmons','Detroit','MI']];
 return people.map(([firstName,lastName,city,state],index)=>({id:`TTI-TEST-20261002-${String(index+1).padStart(2,'0')}`,firstName,lastName,nameEvidence:'explicit_source',phoneRaw:`(312) 555-${String(120+index).padStart(4,'0')}`,phoneNormalized:`+1312555${String(120+index).padStart(4,'0')}`,email:`tti-test-${index+1}@example.com`,city,state,sourceLabel:'Fictional test contact · October 2, 2026',sourceRecordId:null,status:'available',ownerRecruiterId,reservedBy:null,activeConversationId:null,callbackAt:null,rawFields:{note:'TEST ONLY — fictional driver and phone number. Practice the conversation without placing a real call.'},isDemo:true}));
}
export function addMissingTestContacts(contacts:Contact[],ownerRecruiterId:string):Contact[]{
 const known=new Set(contacts.map(contact=>contact.id));
 return [...contacts,...extraTestContacts(ownerRecruiterId).filter(contact=>!known.has(contact.id))];
}

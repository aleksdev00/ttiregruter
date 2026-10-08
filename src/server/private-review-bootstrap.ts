import type {Contact,Recruiter} from '../contracts/index.ts';
import type {Actor} from './access.ts';
import {ownerCatalog,effectiveCatalogOffer} from '../content/carrier-catalog/ownerCatalog.ts';
import {removedCatalogCompany} from '../domain/catalog-removals.ts';

const PRIVATE_TEST_ACCOUNTS=[
 {email:'cvetanovicaleksa45@gmail.com',userId:'private-aleksa',id:'private-performance-review',role:'admin' as const,fullName:'Aleksa Cvetanović',alias:'Alex Jones',seedContacts:true},
 {email:'lakikiller09@gmail.com',userId:'private-lazar',id:'private-performance-lazar',role:'recruiter' as const,fullName:'Lazar Jevtic',alias:'John',seedContacts:false},
 {email:'mikicn956@gmail.com',userId:'private-nate',id:'private-performance-nate',role:'recruiter' as const,fullName:'Nemanja Mikic',alias:'Nate Mitchell',seedContacts:false},
] as const;

export async function privateReviewActor(db:D1Database,user:{userId:string;email:string}):Promise<Actor>{
 const account=PRIVATE_TEST_ACCOUNTS.find(x=>x.email===user.email.toLowerCase());if(!account||user.userId!==account.userId)throw Error('This private test account is not approved.');
 const profile:Recruiter={id:account.id,fullName:account.fullName,alias:account.alias,accountRole:account.role,contactEmail:user.email,referralUrl:null,reportingTimeZone:'Europe/Belgrade',isDemo:true};
 const prior=await db.prepare('SELECT user_id,email FROM recruiters WHERE id=?').bind(account.id).first<{user_id:string;email:string}>();
 if(prior&&prior.email.toLowerCase()!==user.email.toLowerCase())throw Error('This private test account is linked to a different email.');
 const writes:D1PreparedStatement[]=[];
 if(!prior)writes.push(db.prepare('INSERT INTO recruiters(id,user_id,email,role,active,data_json) VALUES(?,?,?,?,1,?)').bind(account.id,user.userId,user.email,account.role,JSON.stringify(profile)));
 else if(prior.user_id!==user.userId)writes.push(db.prepare('UPDATE recruiters SET user_id=?,role=?,data_json=? WHERE id=? AND email=?').bind(user.userId,account.role,JSON.stringify(profile),account.id,user.email));
 if(account.seedContacts&&!prior){
  const contacts:Contact[]=Array.from({length:500},(_,i)=>({id:`TEST-${String(i+1).padStart(4,'0')}`,firstName:'Test',lastName:`Driver ${i+1}`,nameEvidence:'explicit_source',phoneRaw:`+1999555${String(1000+i)}`,phoneNormalized:`+1999555${String(1000+i)}`,email:null,city:'Synthetic City',state:'IL',sourceLabel:'PRIVATE TEST ONLY — synthetic driver',sourceRecordId:null,status:'available',ownerRecruiterId:account.id,reservedBy:null,activeConversationId:null,callbackAt:null,rawFields:{note:'Synthetic performance fixture. Never call or contact this record.',legacy_record_json:JSON.stringify({synthetic:true,padding:'x'.repeat(4096)}),...(i>=490?{myContactRecruiterId:account.id}:{})},isDemo:true}));
  const chunks=Array.from({length:Math.ceil(contacts.length/50)},(_,i)=>contacts.slice(i*50,i*50+50));
  writes.push(db.prepare('INSERT INTO store_revision(id,value) VALUES(1,0) ON CONFLICT(id) DO NOTHING'));
  writes.push(...chunks.map(chunk=>db.prepare("INSERT OR IGNORE INTO drivers(id,owner_id,phone,next_action,data_json) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.phoneNormalized'),'PRIVATE TEST — never place a real call',value FROM json_each(?)").bind(account.id,JSON.stringify(chunk))));
 }
 const offers=ownerCatalog.filter(c=>!removedCatalogCompany(c.id,c.companyName)).flatMap(c=>c.drafts).map(o=>({...effectiveCatalogOffer(o),active:true,recruitingApproved:true,approvalStatus:'approved' as const,isDemo:false}));
 writes.push(db.prepare('INSERT INTO store_revision(id,value) VALUES(1,0) ON CONFLICT(id) DO NOTHING'));
 writes.push(db.prepare("INSERT OR IGNORE INTO companies(id,name,status,version,data_json) SELECT 'private-'||json_extract(value,'$.id'),json_extract(value,'$.companyName'),'active',1,json_object('privateTest',json('true')) FROM json_each(?)").bind(JSON.stringify(offers)));
 writes.push(db.prepare("INSERT OR IGNORE INTO offers(id,company_id,version,data_json) SELECT json_extract(value,'$.id'),'private-'||json_extract(value,'$.id'),json_extract(value,'$.snapshotVersion'),value FROM json_each(?)").bind(JSON.stringify(offers)));
 if(writes.length)await db.batch(writes);
 return {id:account.id,userId:user.userId,email:user.email,role:account.role,profile};
}

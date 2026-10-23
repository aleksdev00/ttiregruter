import type {Recruiter} from '../contracts/index.ts';
import {isAdmin,type Actor} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';

// Existing destinations and the additional recruiter destinations requested by
// the owner on 2026-10-07. Codes are stable and tied to verified account emails.
export const ownerReferralLinks=[
 {key:'nash',email:'azzinjo86@gmail.com',names:['Nash'],url:'https://apply.ttirecruiting.us/?ref=nash'},
 {key:'stephan',email:'grujic.stefan114@gmail.com',names:['Stefan','Stephan Woods','Stephan'],url:'https://apply.ttirecruiting.us/?ref=stephan'},
 {key:'samuel',email:'thesilentflame2@gmail.com',names:['Samuel','Stevan'],url:'https://apply.ttirecruiting.us/?ref=samuel'},
 {key:'john',email:'lakikiller09@gmail.com',names:['John','Lazar'],url:'https://apply.ttirecruiting.us/?ref=john'},
 {key:'alex',email:'cvetanovicaleksa45@gmail.com',names:['Aleksa','Alex Jones'],url:'https://apply.ttirecruiting.us/?ref=alex'},
 {key:'jacob',email:'jovanmill03@gmail.com',names:['Jovan','Jacob'],url:'https://apply.ttirecruiting.us/?ref=jacob'},
 {key:'mike',email:'belopoljacmihailo@gmail.com',names:['Mike','Mihajlo'],url:'https://apply.ttirecruiting.us/?ref=mike'},
 {key:'mila',email:'vuskovic.mila17@gmail.com',names:['Mila'],url:'https://apply.ttirecruiting.us/?ref=mila'},
 {key:'ivona',email:null,names:['Ivona'],url:'https://apply.ttirecruiting.us/?ref=ivona'},
 {key:'natalie',email:null,names:['Natalie'],url:'https://apply.ttirecruiting.us/?ref=natalie'},
 {key:'adriana',email:null,names:['Adriana'],url:'https://apply.ttirecruiting.us/?ref=adriana'},
 {key:'bojan',email:null,names:['Bojan'],url:'https://apply.ttirecruiting.us/?ref=bojan'},
 {key:'dawson',email:null,names:['Dawson Knowledge'],url:'https://apply.ttirecruiting.us/?ref=dawson'},
 {key:'mathew-malone',email:'cukce02@gmail.com',names:['Mathew Malone'],url:'https://apply.ttirecruiting.us/?ref=mathew-malone'},
 {key:'benedeto',email:'d.benedeto@gmail.com',names:['d.benedeto'],url:'https://apply.ttirecruiting.us/?ref=benedeto'},
 {key:'damgluhovic',email:'damgluhovic@gmail.com',names:['damgluhovic'],url:'https://apply.ttirecruiting.us/?ref=damgluhovic'},
 {key:'martha-smith',email:'martatodorovic8@gmail.com',names:['Martha Smith'],url:'https://apply.ttirecruiting.us/?ref=martha-smith'},
 {key:'nate-mitchell',email:'mikicn956@gmail.com',names:['Nate Mitchell'],url:'https://apply.ttirecruiting.us/?ref=nate-mitchell'},
 {key:'marija',email:'milojkov.marija2001@gmail.com',names:['milojkov.marija2001'],url:'https://apply.ttirecruiting.us/?ref=marija'},
 {key:'uros',email:'uros.milovanovic1.um@gmail.com',names:['uros.milovanovic1.um'],url:'https://apply.ttirecruiting.us/?ref=uros'},
 {key:'matt-milano',email:'urosmladenovice25@gmail.com',names:['Matt Milano'],url:'https://apply.ttirecruiting.us/?ref=matt-milano'},
] as const;
const normalize=(name:string)=>name.trim().normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
type Account={id:string;email:string;data_json:string};
export function matchOwnerReferrals(accounts:Account[]){
 return ownerReferralLinks.map(link=>{
  const matches=accounts.filter(account=>{
   if(link.email)return account.email.trim().toLowerCase()===link.email;
   const profile=JSON.parse(account.data_json) as Recruiter;
   return link.names.some(name=>[profile.alias,profile.fullName].some(value=>!!value&&normalize(value)===normalize(name)));
  });
  return {link,account:matches.length===1?matches[0]:null,ambiguous:matches.length>1};
 });
}
// Persist once, retaining an audited before value and later admin edits. Admin
// sessions can apply the authorized batch; recruiter sessions only update self.
export async function applyOwnerReferrals(db:D1Database,actor:Actor){
 const accounts=(await db.prepare('SELECT id,email,data_json FROM recruiters WHERE active=1').all<Account>()).results;
 const matches=matchOwnerReferrals(accounts),statements:D1PreparedStatement[]=[],applied:Account[]=[];
 const candidates=matches.filter(({account})=>account&&(isAdmin(actor)||account.id===actor.id)).flatMap(({link,account})=>{
  if(!account)return [];
  const marker=`owner-referral-20261004:${link.key}:${account.id}`;
  const prior=JSON.parse(account.data_json) as Recruiter;
  // Do not replace a link configured by an administrator after the mapping was
  // added, and keep the TTI Recruiting owner account intentionally unlinked.
  if(prior.referralUrl||account.email.trim().toLowerCase()==='tticdlrecruiting@gmail.com')return [];
  return [{link,account,marker,prior}];
 });
 const existingMarkers=candidates.length
  ?new Set((await db.prepare(`SELECT id FROM audit WHERE id IN (${candidates.map(()=>'?').join(',')})`).bind(...candidates.map(x=>x.marker)).all<{id:string}>()).results.map(row=>row.id))
  :new Set<string>();
 const pending=candidates.filter(x=>!existingMarkers.has(x.marker));
 if(pending.length){
  const revision=await currentRevision(db);
  for(const {link,account,marker,prior} of pending){
  statements.push(db.prepare("UPDATE recruiters SET data_json=json_set(data_json,'$.referralUrl',?) WHERE id=? AND email=? AND active=1").bind(link.url,account.id,account.email));
  statements.push(db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'owner_referral_configured',?,?)").bind(marker,actor.id,Date.now(),JSON.stringify({recruiterId:account.id,previousReferralUrl:prior.referralUrl,nextReferralUrl:link.url,source:'User supplied exact referral destinations, 2026-10-04',noExternalActions:true})));
  applied.push({...account,data_json:JSON.stringify({...prior,referralUrl:link.url})});
  }
  await guardedBatch(db,revision,statements);
 }
 const current=applied.find(account=>account.id===actor.id);if(current)actor.profile=JSON.parse(current.data_json);
 return {updated:applied.length,unresolved:matches.filter(x=>!x.account).map(x=>x.link.key)};
}

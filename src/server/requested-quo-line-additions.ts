import {currentRevision,guardedBatch} from './store.ts';
// Server-only, bounded additions verified against Quo list-inboxes on 2026-10-06.
// Existing profiles, assignments, logins and contact allocations remain unchanged.
export const requestedQuoLines=[
 {id:'PNtJQKocRj',name:'Jake Bennett',number:'+13122627336'},
 {id:'PNIjCXStm4',name:'Frank Parker',number:'+14432961975'},
 {id:'PNQS0bxUVJ',name:'Matt Milano',number:'+13313205855'},
 {id:'PNxPhrHek9',name:'Martha Smith',number:'+12316255327'},
 {id:'PN8T0LPTpt',name:'Mathew Malone',number:'+13312326427'},
] as const;
const marker='requested-quo-line-additions:20261006';
export async function applyRequestedQuoLineAdditions(db:D1Database){
 if(await db.prepare('SELECT id FROM audit WHERE id=?').bind(marker).first())return;
 const actor=await db.prepare("SELECT id FROM recruiters WHERE lower(trim(email))=? AND role IN ('admin','owner') AND active=1").bind('cvetanovicaleksa45@gmail.com').all<{id:string}>();
 if(actor.results.length!==1)return;
 const before=await db.prepare('SELECT * FROM quo_line_profiles').all<{id:string;phone:string}>(),missing=[];
 for(const line of requestedQuoLines){const prior=before.results.find(r=>r.id===line.id);if(prior){if(prior.phone!==line.number)throw Error('Verified Quo line conflicts with an existing profile; no changes applied.');continue;}if(before.results.some(r=>r.phone===line.number))throw Error('Verified Quo phone already exists under another profile; no changes applied.');missing.push(line);}
 const revision=await currentRevision(db),now=Date.now();
 await guardedBatch(db,revision,[...missing.map(l=>db.prepare('INSERT INTO quo_line_profiles(id,display_name,phone,recruiter_id,created_at,updated_at) VALUES(?,?,?,NULL,?,?)').bind(l.id,l.name,l.number,now,now)),db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'requested_quo_line_additions',?,?)").bind(marker,actor.results[0].id,now,JSON.stringify({beforeProfiles:before.results,added:missing,source:'Verified Quo list-inboxes 2026-10-06',noExternalActions:true,assignmentsUnchanged:true}))]);
}

import type {Contact} from '../contracts/index.ts';
import {displayName,isGenericContactName} from '../domain/rules.ts';
import {reliableImportedName} from './contact-migration.ts';
import {normalizePhone} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';
const marker='requested-contact-names:urosmladenovice25:20261006';
function parse(value:unknown):Record<string,unknown>{try{return typeof value==='string'?JSON.parse(value):{};}catch{return {};}}
export function recoverRecordedContactName(c:Contact):string|null{
 const current=reliableImportedName([c.firstName,c.lastName].filter(Boolean).join(' '));if(current&&!isGenericContactName(current))return current;
 const r=parse(c.rawFields.legacy_record_json),phone=normalizePhone(String(r.phone_e164??''));
 if(!phone||phone!==c.phoneNormalized)return null;
 const first=reliableImportedName(r.first_name),last=reliableImportedName(r.last_name),original=[first,last].filter(Boolean).join(' ');
 if(original&&!isGenericContactName(original))return original;
 const records=parse(c.rawFields.legacy_owner_operator_record);if(normalizePhone(String(records.phone_e164??''))===c.phoneNormalized){const n=reliableImportedName([records.first_name,records.last_name].filter(Boolean).join(' '));if(n&&!isGenericContactName(n))return n;}
 try{const rows=JSON.parse(String(r.source_records_json??'[]')) as {reliable_name?:unknown}[];const names=[...new Set(rows.map(x=>reliableImportedName(x.reliable_name)).filter((n):n is string=>!!n&&!isGenericContactName(n)))];const best=names.sort((a,b)=>b.length-a.length)[0];if(best&&names.every(n=>best.toLowerCase()===n.toLowerCase()||best.toLowerCase().startsWith(n.toLowerCase()+' ')))return best;}catch{}
 return null;
}
export async function applyRequestedUrosContactNames(db:D1Database){
 const prior=await db.prepare('SELECT data_json FROM audit WHERE id=?').bind(marker).first<{data_json:string}>();if(prior)return JSON.parse(prior.data_json).summary as {total:number;missingBefore:number;repaired:number;remaining:number};
 const users=await db.prepare('SELECT id FROM recruiters WHERE lower(trim(email))=?').bind('urosmladenovice25@gmail.com').all<{id:string}>();if(users.results.length!==1)return null;
 const owner=users.results[0].id,rows=await db.prepare("SELECT * FROM drivers WHERE owner_id=? AND json_extract(data_json,'$.rawFields.demoRemovedAt') IS NULL").bind(owner).all<{id:string;data_json:string}>();
 const fixes:{row:typeof rows.results[number];contact:Contact}[]=[],summary={total:rows.results.length,missingBefore:0,repaired:0,remaining:0};
 for(const row of rows.results){const c=JSON.parse(row.data_json) as Contact;if(displayName(c)!=='Name not recorded')continue;summary.missingBefore++;const name=recoverRecordedContactName(c);if(!name)continue;const [first,...last]=name.split(/\s+/);c.firstName=first;c.lastName=last.join(' ')||null;c.nameEvidence='explicit_source';fixes.push({row,contact:c});}
 summary.repaired=fixes.length;summary.remaining=summary.missingBefore-fixes.length;
 const revision=await currentRevision(db),now=Date.now();
 await guardedBatch(db,revision,[...fixes.map(x=>db.prepare('UPDATE drivers SET data_json=? WHERE id=? AND owner_id=? AND data_json=?').bind(JSON.stringify(x.contact),x.row.id,owner,x.row.data_json)),db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'requested_contact_names_recovered',?,?)").bind(marker,owner,now,JSON.stringify({summary,before:fixes.map(x=>x.row),evidence:'Existing contact identity or preserved phone-matched import source only',noExternalActions:true,assignmentsUnchanged:true}))]);
 return summary;
}

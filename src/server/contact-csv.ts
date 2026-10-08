import {normalizePhone,ServiceError} from './access.ts';
import {WORKBOOK_SOURCE,reliableImportedName,type Manifest} from './contact-migration.ts';
// RFC 4180-style CSV; no spreadsheet formulas are evaluated.
export function parseCSV(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
 if(ch==='"'){if(field||closed)throw new ServiceError('Invalid CSV quotation. Export the sheet as CSV and retry.');quoted=true;}
 else if(ch===','){row.push(field);field='';closed=false;}
 else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(v=>v.trim()))rows.push(row);row=[];field='';closed=false;}
 else{if(closed&&ch.trim())throw new ServiceError('Unexpected text after a quoted CSV field.');if(!closed)field+=ch;}}
 if(quoted)throw new ServiceError('Unclosed quoted CSV field.');row.push(field);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export async function contactCSVManifest(text:string,fileName:string):Promise<Manifest>{
 const rows=parseCSV(text.replace(/^\uFEFF/,''));if(rows.length<2)throw new ServiceError('CSV needs a header and at least one contact.');if(rows.length>5001)throw new ServiceError('Import up to 5,000 contacts per CSV file.');
 const headers=rows[0].map(v=>v.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));if(new Set(headers).size!==headers.length)throw new ServiceError('CSV has duplicate column headings.');
 const aliases:Record<string,string[]>={phone_e164:['phone','phone_number','mobile','phone_e164'],first_name:['first_name','first'],last_name:['last_name','last'],email:['email','driver_email'],city:['city'],state:['state'],assigned_email:['recruiter_email','assigned_email'],notes:['notes','note'],lead_status:['status','lead_status'],contact_blocked:['do_not_contact','contact_blocked'],follow_up_at:['callback_at','follow_up_at']};
 if(!aliases.phone_e164.some(v=>headers.includes(v)))throw new ServiceError('CSV must include a phone column. Supported headings: first_name, last_name, name, phone, email, city, state, notes, recruiter_email, status, do_not_contact, callback_at.');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const groups=new Map<string,Array<Record<string,string|number|boolean|null>>>(),review:Manifest['review']={summary:{csvRows:rows.length-1,csvDuplicatesSkipped:0,csvInvalidSkipped:0,csvAmbiguousSkipped:0},records:[]};
 rows.slice(1).forEach((values,index)=>{if(values.length!==headers.length)throw new ServiceError(`CSV row ${index+2} has a different number of columns.`);const raw=Object.fromEntries(headers.map((h,i)=>[h,values[i].trim()])),r:Record<string,string|number|boolean|null>={...raw,id:`csv-${digest.slice(0,24)}-${index+2}`,source:fileName};
 for(const [key,names] of Object.entries(aliases)){const field=names.find(name=>raw[name]);if(field)r[key]=raw[field];}
 if(!r.first_name&&raw.name){const full=reliableImportedName(raw.name);if(full){const parts=full.split(/\s+/);r.first_name=parts.shift()!;r.last_name=parts.join(' ');}}
 const phone=normalizePhone(String(r.phone_e164??''));if(!phone){review.summary.csvInvalidSkipped++;review.records.push({row:index+2,reason:'Invalid or missing phone; not imported'});return;}
 r.contact_blocked=/^(true|yes|1|do_not_contact)$/i.test(String(r.contact_blocked??''))||/^do[ _-]?not[ _-]?contact$/i.test(String(r.lead_status??''));r.lead_status=r.contact_blocked?'do_not_contact':String(r.lead_status||'new').toLowerCase().replace(/\s+/g,'_');
 if(r.follow_up_at){const date=Date.parse(String(r.follow_up_at));if(!Number.isFinite(date))throw new ServiceError(`CSV row ${index+2}: callback_at must be a valid date.`);r.follow_up_at=date;}
 groups.set(phone,[...(groups.get(phone)??[]),r]);});
 const profiles:Manifest['driver_profiles']=[];
 for(const group of groups.values()){
 const names=new Set(group.map(r=>[r.first_name,r.last_name].filter(Boolean).join(' ').toLowerCase()).filter(Boolean));const owners=new Set(group.map(r=>String(r.assigned_email??'').toLowerCase()).filter(Boolean));
 if(names.size>1||owners.size>1){review.summary.csvAmbiguousSkipped+=group.length;for(const r of group)review.records.push({sourceId:r.id,reason:'Shared phone with conflicting names or recruiter emails; all rows held for owner review'});continue;}
 const record=group.find(r=>r.contact_blocked)||group[0];profiles.push(record);review.summary.csvDuplicatesSkipped+=group.length-1;
 }
 if(!profiles.length)throw new ServiceError('No valid, unambiguous contacts to import. Review phone numbers and duplicate identities.');
 return {schemaVersion:1,sourceProjectId:WORKBOOK_SOURCE,extractedAt:new Date().toISOString(),driver_profiles:profiles,owner_operator_contacts:[],recruiters:[],contact_batches:[],contact_batch_items:[],review};
}

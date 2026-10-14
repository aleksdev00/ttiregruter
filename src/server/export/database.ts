import {sourceTables,postgresSchema} from './schema.ts';
import {ServiceError} from '../access.ts';
export const exportEmail='cvetanovicaleksa45@gmail.com';
export function requireExportIdentity(user:{email:string;userId:string}|null,record:{email:string;role:string;active:number;user_id:string|null}|null){
 if(!user||user.email.toLowerCase()!==exportEmail||!record||record.email.toLowerCase()!==exportEmail||record.user_id!==user.userId||record.active!==1||!['admin','owner'].includes(record.role))throw new ServiceError('This export is available only to Aleksa’s approved administrator account.',403,'not_allowed');
}
export function quoteIdentifier(value:string){return '"'+value.replaceAll('"','""')+'"';}
export function pgValue(value:unknown):string{
 if(value===null||value===undefined)return 'NULL';
 if(typeof value==='number'){if(!Number.isFinite(value)||!Number.isSafeInteger(value))throw new ServiceError('An unsupported numeric value prevents a lossless export.',409,'export_incomplete');return String(value);}
 if(typeof value!=='string'||value.includes('\u0000'))throw new ServiceError('An unsupported source value prevents a lossless export.',409,'export_incomplete');
 return "'"+value.replaceAll("'","''")+"'";
}
export function sanitizedValue(table:string,column:string,value:unknown){
 if(column==='lease_token'||column==='lease_at')return null;
 if(table==='work_sessions'){
  if(column.startsWith('code_')||column==='verified_at')return null;
  if(column==='verification_attempts')return 0;
  if(column==='status')return 'expired';
 }
 return value;
}
export type TableSnapshot={name:string;columns:string[];rows:Record<string,unknown>[]};
export async function validateSourceSchema(db:D1Database){
 // Leading-underscore tables are platform internals, not application records.
 // GLOB treats underscores literally; LIKE '_' is a wildcard.
 const names=(await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_*' AND name NOT IN ('d1_migrations','tti_schema_migrations','recruiter_login_bindings','recruiter_login_sessions','recruiter_login_attempts') ORDER BY name").all<{name:string}>()).results.map(x=>x.name).sort();
 const expected=sourceTables.map(t=>t.name).sort();
 if(JSON.stringify(names)!==JSON.stringify(expected)){const extra=names.filter(n=>!expected.includes(n as typeof expected[number])),missing=expected.filter(n=>!names.includes(n));throw new ServiceError('Database schema changed. Unexpected tables: '+(extra.join(', ')||'none')+'. Missing tables: '+(missing.join(', ')||'none')+'. No partial export was produced.',409,'export_incomplete');}
 const cols=await db.batch<{name:string}>(sourceTables.map(t=>db.prepare('PRAGMA table_info('+quoteIdentifier(t.name)+')')));
 for(let i=0;i<cols.length;i++)if(JSON.stringify(cols[i].results.map(r=>r.name).sort())!==JSON.stringify(sourceTables[i].columns.map(c=>c.name).sort()))throw new ServiceError('Database columns changed in '+sourceTables[i].name+'. Update the export schema first.',409,'export_incomplete');
}
export async function databaseSnapshot(db:D1Database):Promise<TableSnapshot[]>{
 await validateSourceSchema(db);
 const size=await db.batch<{n:number;bytes:number}>(sourceTables.map(t=>db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM('+t.columns.map(c=>'COALESCE(length(CAST('+quoteIdentifier(c.name)+' AS BLOB)),0)').join('+')+'),0) AS bytes FROM '+quoteIdentifier(t.name))));
 const bytes=size.reduce((n,r)=>n+Number(r.results[0].bytes),0),count=size.reduce((n,r)=>n+Number(r.results[0].n),0);
 if(bytes>16*1024*1024||count>100000)throw new ServiceError('The complete database exceeds the safe Worker snapshot limit. A platform-level D1 export is required; no partial download was produced.',413,'export_too_large');
 // D1 batch statements run sequentially in one transaction: every table belongs to one snapshot.
 const data=await db.batch<Record<string,unknown>>(sourceTables.map(t=>db.prepare('SELECT '+t.columns.map(c=>quoteIdentifier(c.name)).join(',')+' FROM '+quoteIdentifier(t.name))));
 if(data.some(r=>!r.success))throw new ServiceError('The complete snapshot could not be read. Retry; no partial export was produced.',503,'export_incomplete');
 const snapshot=sourceTables.map((t,i)=>({name:t.name,columns:t.columns.map(c=>c.name),rows:data[i].results}));
 // Validate every value before issuing a successful download response.
 for(const t of snapshot)for(const row of t.rows)for(const c of t.columns)pgValue(sanitizedValue(t.name,c,row[c]));
 return snapshot;
}
export function postgresHeader(now:string){
 return '-- TTI Recruiter: complete business database snapshot '+now+'\n'+
 '-- Historical login codes and transient delivery leases are cleared.\n'+
 '-- R2 objects and Supabase Auth accounts are migrated separately.\n'+
 postgresSchema+'\nBEGIN;\nSET standard_conforming_strings = on;\nSET CONSTRAINTS ALL DEFERRED;\n'+
 'DO $tti_empty$ BEGIN IF EXISTS ('+sourceTables.map(t=>'SELECT 1 FROM public.'+quoteIdentifier(t.name)).join(' UNION ALL ')+") THEN RAISE EXCEPTION 'Destination business tables must be empty. No data was overwritten.'; END IF; END $tti_empty$;\n";
}
export function postgresInsert(table:Pick<TableSnapshot,'name'|'columns'>,row:Record<string,unknown>){return 'INSERT INTO public.'+quoteIdentifier(table.name)+' ('+table.columns.map(quoteIdentifier).join(',')+') VALUES ('+table.columns.map(c=>pgValue(sanitizedValue(table.name,c,row[c]))).join(',')+');\n';}
export function postgresFooter(counts:{name:string;count:number}[]){
 return 'DO $tti_counts$ BEGIN\n'+counts.map(t=>'IF (SELECT COUNT(*) FROM public.'+quoteIdentifier(t.name)+') <> '+t.count+" THEN RAISE EXCEPTION 'Incomplete import: "+t.name+"'; END IF;\n").join('')+'END $tti_counts$;\nCOMMIT;\n-- END OF COMPLETE DATABASE EXPORT\n';
}
export function* postgresLines(snapshot:TableSnapshot[],now:string){
 yield postgresHeader(now);
 for(const t of snapshot){yield '-- '+t.name+': '+t.rows.length+' source rows\n';for(const row of t.rows)yield postgresInsert(t,row);}
 yield postgresFooter(snapshot.map(t=>({name:t.name,count:t.rows.length})));
}
export function textStream(lines:Iterable<string>){const iterator=lines[Symbol.iterator](),encoder=new TextEncoder();return new ReadableStream<Uint8Array>({pull(controller){const step=iterator.next();if(step.done)controller.close();else controller.enqueue(encoder.encode(step.value));},cancel(){iterator.return?.();}});}

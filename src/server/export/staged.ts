import {sourceTables} from './schema.ts';
import {ServiceError} from '../access.ts';
import {quoteIdentifier as qi,validateSourceSchema,postgresHeader,postgresFooter,postgresInsert} from './database.ts';
type Run={id:string;owner_user_id:string;created_at:number;expires_at:number;status:string};
const staging=(name:string)=>qi('_tti_export_'+name);
export async function getRun(db:D1Database,userId:string,id:string){
 if(!/^[a-f0-9-]{36}$/.test(id))throw new ServiceError('Invalid export identifier.');
 const run=await db.prepare('SELECT * FROM _tti_export_runs WHERE id=? AND owner_user_id=? AND status=\'ready\' AND expires_at>?').bind(id,userId,Date.now()).first<Run>();
 if(!run)throw new ServiceError('This snapshot is unavailable or expired. Start a new export.',404,'export_expired');return run;
}
export async function releaseRun(db:D1Database,userId:string,id:string){
 await getRun(db,userId,id);
 await db.batch([...sourceTables.map(t=>db.prepare('DELETE FROM '+staging(t.name)+' WHERE _export_id=?').bind(id)),db.prepare("UPDATE _tti_export_runs SET status='released' WHERE id=? AND owner_user_id=?").bind(id,userId)]);
}
export async function manifest(db:D1Database,run:Run){
 // D1 restricts compound SELECT terms more tightly than Node SQLite.
 // Independent COUNT statements avoid that limit without reading record payloads.
 const counts=await db.batch<{count:number}>(sourceTables.map(t=>db.prepare('SELECT COUNT(*) AS count FROM '+staging(t.name)+' WHERE _export_id=?').bind(run.id)));
 const tables=sourceTables.map((t,i)=>({name:t.name,count:Number(counts[i].results[0].count)}));
 return {id:run.id,createdAt:run.created_at,expiresAt:run.expires_at,tables,header:postgresHeader(new Date(run.created_at).toISOString()),footer:postgresFooter(tables)};
}
export async function createRun(db:D1Database,userId:string){
 await validateSourceSchema(db);
 const now=Date.now();
 const active=await db.prepare("SELECT * FROM _tti_export_runs WHERE owner_user_id=? AND status='ready' AND expires_at>?").bind(userId,now).first<Run>();
 if(active)return manifest(db,active);
 // Remove only this user's expired export artifacts, never live source records.
 await db.batch([...sourceTables.map(t=>db.prepare('DELETE FROM '+staging(t.name)+" WHERE _export_id IN (SELECT id FROM _tti_export_runs WHERE owner_user_id=? AND status='ready' AND expires_at<=?)").bind(userId,now)),db.prepare("UPDATE _tti_export_runs SET status='released' WHERE owner_user_id=? AND status='ready' AND expires_at<=?").bind(userId,now)]);
 const run:Run={id:crypto.randomUUID(),owner_user_id:userId,created_at:now,expires_at:now+86400000,status:'ready'};
 const statements=[db.prepare('INSERT INTO _tti_export_runs(id,owner_user_id,created_at,expires_at,status) VALUES(?,?,?,?,?)').bind(run.id,userId,now,run.expires_at,run.status)];
 for(const t of sourceTables){
  const columns=t.columns.map(c=>qi(c.name));
  const values=t.columns.map(c=>c.name==='lease_token'||c.name==='lease_at'?'NULL':t.name==='work_sessions'&&(c.name.startsWith('code_')||c.name==='verified_at')?'NULL':t.name==='work_sessions'&&c.name==='status'?"'expired'":t.name==='work_sessions'&&c.name==='verification_attempts'?'0':qi(c.name));
  statements.push(db.prepare('INSERT INTO '+staging(t.name)+' (_export_id,_export_row,'+columns.join(',')+') SELECT ?,ROW_NUMBER() OVER ()-1,'+values.join(',')+' FROM '+qi(t.name)).bind(run.id));
 }
 // Copies run inside one D1 transaction and return no full source payload to Worker memory.
 try{await db.batch(statements);}catch(error){const other=await db.prepare("SELECT * FROM _tti_export_runs WHERE owner_user_id=? AND status='ready' AND expires_at>?").bind(userId,now).first<Run>();if(other)return manifest(db,other);throw error;}
 return manifest(db,run);
}
export async function exportPart(db:D1Database,userId:string,id:string,name:string,offset:number){
 await getRun(db,userId,id);
 const table=sourceTables.find(t=>t.name===name);if(!table||!Number.isSafeInteger(offset)||offset<0)throw new ServiceError('Invalid export table or cursor.');
 const cols=table.columns.map(c=>qi(c.name));
 const bytes=cols.map(c=>'COALESCE(length(CAST('+c+' AS BLOB)),0)').join('+');
 const sql='WITH candidates AS (SELECT _export_row,'+cols.join(',')+' FROM '+staging(name)+' WHERE _export_id=? AND _export_row>=? ORDER BY _export_row LIMIT 100), bounded AS (SELECT *,SUM('+bytes+') OVER (ORDER BY _export_row) AS _bytes FROM candidates) SELECT _export_row,'+cols.join(',')+' FROM bounded WHERE _bytes<=1048576 OR _export_row=? ORDER BY _export_row';
 const rows=(await db.prepare(sql).bind(id,offset,offset).all<Record<string,unknown>>()).results;
 const text=rows.map(row=>postgresInsert({name,columns:table.columns.map(c=>c.name)},row)).join('');
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
 return {sql:text,rows:rows.length,nextOffset:rows.length?Number(rows.at(-1)!._export_row)+1:offset,sha256:digest};
}

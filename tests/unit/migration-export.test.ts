import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {sourceTables} from '../../src/server/export/schema.ts';
import {databaseSnapshot,postgresLines,pgValue,requireExportIdentity} from '../../src/server/export/database.ts';
import {crc32,zipEntries} from '../../src/server/export/files.ts';

test('export requires the exact approved identity, current binding and admin role',()=>{
 const user={email:'cvetanovicaleksa45@gmail.com',userId:'trusted'},record={email:user.email,user_id:'trusted',active:1,role:'admin'};
 assert.doesNotThrow(()=>requireExportIdentity(user,record));
 for(const [u,r] of [[null,record],[{...user,email:'other@example.test'},record],[user,{...record,user_id:'other'}],[user,{...record,role:'recruiter'}],[user,{...record,active:0}]])assert.throws(()=>requireExportIdentity(u as typeof user,r as typeof record));
});
test('full database snapshot reads every source table without mutations and preserves values',async()=>{
 const sqlite=new DatabaseSync(':memory:');
 for(const t of sourceTables)sqlite.exec('CREATE TABLE "'+t.name+'" ('+t.columns.map(c=>'"'+c.name+'" '+c.type).join(',')+')');
 sqlite.exec('CREATE TABLE __drizzle_migrations(id INTEGER); CREATE TABLE _cf_METADATA(key TEXT); CREATE TABLE _litestream_seq(seq INTEGER); CREATE TABLE d1_migrations(id INTEGER);');
 sqlite.exec('ALTER TABLE quo_mappings RENAME TO old_quo_mappings; CREATE TABLE quo_mappings(actor_id TEXT, verified_at INTEGER, recruiter_id TEXT, id TEXT); DROP TABLE old_quo_mappings;');
 const json=JSON.stringify({name:"O'Brien Ž",note:"\\\n'); DROP TABLE drivers; --",dnc:true});
 sqlite.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,?,?,?,?)').run('d1','r1','+10000000000',1,0,'do_not_contact',json);
 sqlite.prepare('INSERT INTO work_sessions(id,code_hash,status) VALUES(?,?,?)').run('w1','sensitive','verified');
 const statements:string[]=[];
 const prepare=(sql:string)=>{statements.push(sql);return {all:async()=>({success:true,results:sqlite.prepare(sql).all()}),sql};};
 const db={prepare,batch:async(q:{sql:string}[])=>{sqlite.exec('BEGIN');try{const r=q.map(s=>({success:true,results:sqlite.prepare(s.sql).all()}));sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 const snapshot=await databaseSnapshot(db);assert.equal(snapshot.length,31);
 assert.equal(snapshot.find(t=>t.name==='drivers')!.rows[0].data_json,json);
 assert.ok(statements.every(s=>/^(SELECT|PRAGMA)/.test(s)));
 const sql=Array.from(postgresLines(snapshot,'2026-10-13T00:00:00Z')).join('');
 assert.ok(sql.endsWith('-- END OF COMPLETE DATABASE EXPORT\n'));assert.ok(!sql.includes("'sensitive'"));assert.ok(sql.includes("'expired'"));
 assert.ok(sql.includes(pgValue(json)));assert.ok(sql.includes('"drivers") <> 1'));
 sqlite.exec('CREATE TABLE extra(id TEXT)');await assert.rejects(databaseSnapshot(db),/schema changed/);sqlite.close();
});
test('SQL quoting rejects unsupported values and escapes apostrophes',()=>{
 assert.equal(pgValue("a'b\\c"),"'a''b\\c'");assert.equal(pgValue(null),'NULL');
 assert.throws(()=>pgValue('\u0000'));assert.throws(()=>pgValue(Number.MAX_SAFE_INTEGER+1));
});
test('ZIP streams original bytes, correct CRC and complete directory; rejects missing bytes',async()=>{
 const bytes=new TextEncoder().encode('123456789');assert.equal(crc32(bytes),0xcbf43926);
 assert.equal(crc32(bytes.slice(4),crc32(bytes.slice(0,4))),0xcbf43926);
 const entry={key:'documents/synthetic.txt',size:bytes.length,etag:'test'};
 const read=async()=>new ReadableStream<Uint8Array>({start(c){c.enqueue(bytes.slice(0,4));c.enqueue(bytes.slice(4));c.close();}});
 const chunks=[];for await(const b of zipEntries([entry],read))chunks.push(b);
 assert.equal(new DataView(chunks.at(-1)!.buffer).getUint32(0,true),0x06054b50);
 await assert.rejects(async()=>{for await(const b of zipEntries([{...entry,size:10}],read))void b;},/size changed/);
 await assert.rejects(async()=>{for await(const b of zipEntries([{...entry,key:'../escape'}],read))void b;},/Unsafe/);
});

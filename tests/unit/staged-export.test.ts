import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {sourceTables} from '../../src/server/export/schema.ts';
import {createRun,exportPart,releaseRun,getRun} from '../../src/server/export/staged.ts';
function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 for(const t of sourceTables)sqlite.exec('CREATE TABLE "'+t.name+'" ('+t.columns.map(c=>'"'+c.name+'" '+c.type).join(',')+')');
 sqlite.exec(readFileSync(new URL('../../drizzle/0010_slow_natasha_romanoff.sql',import.meta.url),'utf8'));
 const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({success:true,results:sqlite.prepare(sql).all(...args as never[])}),sql,args});
 const db={prepare,batch:async(q:ReturnType<typeof prepare>[])=>{sqlite.exec('BEGIN');try{const results=q.map(s=>({success:true,results:sqlite.prepare(s.sql).all(...s.args as never[])}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 return {sqlite,db};
}
test('staged export exceeds old 16 MiB limit, uses stable snapshot and verifies bounded pages',async()=>{
 const {sqlite,db}=fixture();
 const payload=JSON.stringify({name:"O'Brien",note:'x'.repeat(1900000),dnc:true});
 const insert=sqlite.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,?,?,?,?)');
 for(let i=0;i<9;i++)insert.run('d'+i,'r1','+1000000000'+i,1,0,'do_not_contact',payload);
 assert.ok(payload.length*9>16*1024*1024);
 const run=await createRun(db,'u1');assert.equal(run.tables.length,31);assert.equal(run.tables.find(t=>t.name==='drivers')!.count,9);
 const repeated=await createRun(db,'u1');assert.equal(repeated.id,run.id);
 sqlite.exec("UPDATE drivers SET data_json='changed after snapshot'; DELETE FROM drivers WHERE id='d8';");
 let offset=0,total=0;
 while(offset<9){const part=await exportPart(db,'u1',run.id,'drivers',offset);assert.equal(part.rows,1);assert.ok(part.sql.includes("O''Brien"));assert.ok(!part.sql.includes('changed after snapshot'));const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(part.sql))),b=>b.toString(16).padStart(2,'0')).join('');assert.equal(part.sha256,digest);offset=part.nextOffset;total+=part.rows;}
 assert.equal(total,9);await assert.rejects(exportPart(db,'other',run.id,'drivers',0),/unavailable/);await assert.rejects(exportPart(db,'u1',run.id,'drivers;DROP',0),/Invalid/);
 await releaseRun(db,'u1',run.id);await assert.rejects(getRun(db,'u1',run.id),/unavailable/);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM _tti_export_drivers').get()!.n,0);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM drivers').get()!.n,8);
 const fresh=await createRun(db,'u1');assert.notEqual(fresh.id,run.id);assert.equal(fresh.tables.find(t=>t.name==='drivers')!.count,8);sqlite.close();
});
test('failed snapshot creation rolls back every copied row and run metadata',async()=>{
 const {sqlite,db}=fixture();sqlite.exec("INSERT INTO companies(id,name) VALUES('c','test'); DROP TABLE _tti_export_work_sessions;");
 await assert.rejects(createRun(db,'u1'));
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM _tti_export_runs').get()!.n,0);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM _tti_export_companies').get()!.n,0);
 assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM companies').get()!.n,1);sqlite.close();
});

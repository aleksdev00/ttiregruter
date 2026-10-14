import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {sourceTables} from '../../src/server/export/schema.ts';
import {createRun,exportPart} from '../../src/server/export/staged.ts';
const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=wranglerRequire('miniflare');
test('D1 runtime exports all 31 tables without compound-SELECT limit and reuses existing snapshot',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-15',d1Databases:{DB:'00000000-0000-0000-0000-000000000000'}});
 try{
  const db=await mf.getD1Database('DB') as D1Database;
  for(const t of sourceTables)await db.prepare('CREATE TABLE "'+t.name+'" ('+t.columns.map(c=>'"'+c.name+'" '+c.type).join(',')+')').run();
  for(const sql of readFileSync(new URL('../../drizzle/0010_slow_natasha_romanoff.sql',import.meta.url),'utf8').split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql.trim()).run();
  // Regression: Node SQLite accepted this query but real D1 rejects it.
  await assert.rejects(db.prepare(sourceTables.map(()=>"SELECT 1 AS n").join(' UNION ALL ')).all(),/too many terms in compound SELECT/);
  await db.prepare('INSERT INTO drivers(id,blocked,next_action,data_json) VALUES(?,?,?,?)').bind('synthetic',1,'do_not_contact','{"name":"Synthetic"}').run();
  const run=await createRun(db,'synthetic-user');assert.equal(run.tables.length,31);assert.equal(run.tables.find(t=>t.name==='drivers')?.count,1);
  const repeat=await createRun(db,'synthetic-user');assert.equal(repeat.id,run.id);
  const part=await exportPart(db,'synthetic-user',run.id,'drivers',0);assert.equal(part.rows,1);assert.equal(part.nextOffset,1);assert.equal(part.sha256.length,64);assert.ok(part.sql.includes('Synthetic'));
 }finally{await mf.dispose();}
});

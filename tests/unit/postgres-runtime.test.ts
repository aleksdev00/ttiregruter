import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';
import {postgresStatement} from '../../src/server/postgres-sql.ts';
import {createPostgresDatabase} from '../../src/server/postgres-db.ts';
import {postgresSchema} from '../../src/server/export/schema.ts';
import {loadSnapshot,workflowMutation,guardedBatch,currentRevision} from '../../src/server/store.ts';
import {operation,overview} from '../../src/server/operations.ts';
import {seed} from '../../src/adapters/demo/seed.ts';
import {AuthEngine} from '../../src/server/auth/engine.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Actor} from '../../src/server/access.ts';
import type {Conversation,Result} from '../../src/contracts/index.ts';

test('SQL values stay bound, quoted question marks stay literal, and unreviewed SQL fails closed',()=>{
 const value="Robert'); DROP TABLE drivers; --";
 const result=postgresStatement("SELECT ? AS input, '?' AS literal, 'json_set(?,x)' AS untouched",[value]);
 assert.deepEqual(result.values,[value]);assert.ok(!result.sql.includes(value));assert.ok(result.sql.includes("'?'"));
 assert.throws(()=>postgresStatement('SELECT ?; DELETE FROM drivers',[value]),/one statement/);
 assert.throws(()=>postgresStatement('SELECT ?',[]),/parameter count/);
 assert.throws(()=>postgresStatement("SELECT json_extract(data_json,'$[0]')"),/JSON path/);
 assert.throws(()=>postgresStatement('INSERT OR REPLACE INTO drivers(id) VALUES(?)',['x']),/Unreviewed/);
});

test('PostgreSQL runs the actual recruiter workflow, JSON projection, atomic saves and encrypted sessions',async t=>{
 const pg=new PGlite();
 t.after(()=>pg.close());
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
 await pg.exec(postgresSchema);
 await pg.exec(readFileSync('integrations/supabase/20261014_login_runtime.sql','utf8'));
 await pg.exec(readFileSync('integrations/supabase/20261014_json_compat.sql','utf8'));
 const execute=async(sql:string,values:readonly unknown[])=>{try{const r=await pg.query(sql,[...values]);return {rows:r.rows as Record<string,unknown>[],count:r.affectedRows??r.rows.length};}catch(e){if(String(e).includes('tti_revision_guard'))throw Error('mutation_must_claim_revision');throw e;}};
 const db=createPostgresDatabase({query:execute,transaction:run=>pg.transaction(async tx=>run(async(sql,values)=>{try{const r=await tx.query(sql,[...values]);return {rows:r.rows as Record<string,unknown>[],count:r.affectedRows??r.rows.length};}catch(e){if(String(e).includes('tti_revision_guard'))throw Error('mutation_must_claim_revision');throw e;}}))});
 const actor=(id:string,role:Actor['role']='recruiter'):Actor=>({id,userId:'user-'+id,email:id+'@fixture.invalid',role,profile:{...seed().recruiter,id,fullName:'Synthetic '+id,alias:'Alias '+id,isDemo:false}});
 const a=actor('a'),b=actor('b'),admin=actor('admin','admin');
 for(const user of [a,b,admin])await db.prepare('INSERT INTO recruiters(id,user_id,email,role,active,data_json) VALUES(?,?,?,?,1,?)').bind(user.id,user.userId,user.email,user.role,JSON.stringify(user.profile)).run();
 await db.prepare('INSERT INTO store_revision(id,value) VALUES(1,0)').run();
 const ok=<T>(result:Result<T>):T=>{assert.equal(result.ok,true,JSON.stringify(result));return (result as {ok:true;value:T}).value;};
 let driverId:string,conversation:Conversation;
 await t.test('JSON edits create missing nested objects, preserve scalar types and explicit null',async()=>{
   const row=await db.prepare("SELECT json_set('{}','$.rawFields.new',?,'$.active',json('true'),'$.revision',?,'$.missing',NULL) AS value").bind('quoted ? $1',3).first<{value:string}>();
   assert.deepEqual(JSON.parse(row!.value),{rawFields:{new:'quoted ? $1'},active:true,revision:3,missing:null});
   const numeric=await db.prepare("SELECT COALESCE(json_extract(?,'$.isDemo'),0) AS n").bind('{"isDemo":true}').first<{n:number}>();assert.equal(Number(numeric!.n),1);
 });
 await t.test('custom contacts stay assigned and one recruiter cannot read another recruiter contact',async()=>{
   driverId=(await operation(db,a,'create_driver',{name:'Fictional Driver',phone:'+12025550191',email:'',nextAction:'Synthetic verification'}) as {id:string}).id;
   const snapshot=await loadSnapshot(db,a);assert.equal(snapshot.contacts.length,1);assert.equal(snapshot.contacts[0].firstName,'Fictional');assert.equal((await loadSnapshot(db,b)).contacts.length,0);
   await assert.rejects(workflowMutation(db,b,'claimContact',[driverId,{requestId:'denied-claim'}]),/not available/);
 });
 await t.test('contact opens, progress persists on a new snapshot, retries are idempotent',async()=>{
   conversation=ok(await workflowMutation(db,a,'claimContact',[driverId,{requestId:'postgres-claim'}])) as Conversation;
   assert.equal((await loadSnapshot(db,a)).conversations.length,1);
   ok(await workflowMutation(db,a,'recordAttempt',[conversation.id,{requestId:'postgres-attempt'}]));
   ok(await workflowMutation(db,a,'conversationAction',[conversation.id,'interested',{requestId:'postgres-interested'}]));
   const args=[conversation.id,{safeToTalk:true},'guide_position',{requestId:'postgres-answer'}];
   ok(await workflowMutation(db,a,'saveAnswers',args));ok(await workflowMutation(db,a,'saveAnswers',args));
   const saved=(await loadSnapshot(db,a)).conversations[0];assert.equal(saved.answers.safeToTalk,true);
 });
 await t.test('stale revisions roll back every write',async()=>{
   const revision=await currentRevision(db);
   await assert.rejects(guardedBatch(db,revision-1,[db.prepare('UPDATE recruiters SET active=0 WHERE id=?').bind(a.id)]),/Records changed/);
   assert.equal(Number((await db.prepare('SELECT active FROM recruiters WHERE id=?').bind(a.id).first<{active:number}>())!.active),1);
   assert.equal(await currentRevision(db),revision);
 });
 await t.test('admin overview and live offers execute PostgreSQL JSON projections',async()=>{
   const offer={...seed().offers[0],id:'synthetic-offer',isDemo:false,active:true,source:'google_sheet',approvalStatus:'approved'};
   await db.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').bind('synthetic-company',offer.companyName,'active',1,'{"urgent":1}').run();
   await db.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').bind(offer.id,'synthetic-company','1',JSON.stringify(offer)).run();
   assert.equal((await loadSnapshot(db,a)).offers[0].urgent,true);assert.equal((await overview(db,admin)).role,'admin');
 });
 await t.test('explicit completion persists locally without application submission or a network action',async()=>{
   ok(await workflowMutation(db,a,'finish',[conversation.id,'callback','2035-01-01T12:00:00.000Z',{requestId:'postgres-finish'}]));
   assert.equal((await loadSnapshot(db,a)).conversations[0].outcome,'callback');
   assert.equal(Number((await db.prepare('SELECT COUNT(*) AS n FROM applications').first<{n:number}>())!.n),0);
 });
 await t.test('upserts and JSON array membership preserve stable records',async()=>{
   await db.prepare('INSERT OR IGNORE INTO store_revision(id,value) VALUES(1,999)').run();
   assert.notEqual(await currentRevision(db),999);
   assert.equal((await db.prepare('SELECT id FROM recruiters WHERE id IN (SELECT value FROM json_each(?))').bind('["a","b"]').all()).results.length,2);
   assert.ok(await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='recruiter_login_sessions'").first());
 });
 await t.test('all static server-authored runtime statements plan on PostgreSQL',async()=>{
   let checked=0;
   for(const file of readdirSync('src/server',{recursive:true}).filter(f=>typeof f==='string'&&f.endsWith('.ts')&&!f.startsWith('export/')) as string[]){
     const source=ts.createSourceFile(file,readFileSync('src/server/'+file,'utf8'),ts.ScriptTarget.Latest,true);
     const queries:string[]=[];
     function visit(node:ts.Node){
       if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='prepare'&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0]))queries.push(node.arguments[0].text);
       ts.forEachChild(node,visit);
     }
     visit(source);
     for(const sql of queries){
       let count=0;try{postgresStatement(sql,[]);}catch(e){if(!String(e).includes('parameter count'))throw e;}
       // Count only actual parameter tokens; quoted question marks are preserved.
       for(;count<80;count++){try{postgresStatement(sql,Array(count).fill(null));break;}catch(e){if(!String(e).includes('parameter count'))throw e;}}
       const query=postgresStatement(sql,Array(count).fill(null));
       try{await pg.query('EXPLAIN '+query.sql,[...query.values]);}catch(error){throw new Error(file+': '+sql+'\n'+String(error));}
       checked++;
     }
   }
   assert.ok(checked>80,'Expected broad runtime query coverage');
 });
 await t.test('login preserves roles; logout and strict 24-hour expiry invalidate sessions',async()=>{
   const id='00000000-0000-4000-8000-000000000001';await pg.query('INSERT INTO auth.users(id) VALUES($1)',[id]);
   await db.prepare('INSERT INTO recruiter_login_bindings(recruiter_id,auth_user_id,verified_email,must_change,updated_at) VALUES(?,?,?,1,0)').bind(a.id,id,a.email).run();
   let now=Date.now();const user={id,email:a.email,email_confirmed_at:'2026-01-01'};
   const session=()=>({user,access_token:'synthetic-access',refresh_token:'synthetic-refresh',expires_at:now/1000+3600,expires_in:3600});
   const client={auth:{signInWithPassword:async()=>({data:{user,session:session()},error:null}),getUser:async()=>({data:{user},error:null}),refreshSession:async()=>({data:{session:session()},error:null}),admin:{signOut:async()=>({error:null})}}} as unknown as SupabaseClient;
   const engine=new AuthEngine(db,()=>client,Buffer.alloc(32,7).toString('base64url'),()=>now);
   const login=await engine.login(a.email,'synthetic-password');assert.equal(login.user.actor.role,'recruiter');assert.equal(login.user.recruiterId,a.id);assert.ok(await engine.read(login.token));
   const encrypted=await db.prepare('SELECT encrypted_tokens FROM recruiter_login_sessions').first<{encrypted_tokens:string}>();assert.ok(!encrypted!.encrypted_tokens.includes('synthetic-access'));
   now+=86400000;assert.equal(await engine.read(login.token),null);
   const second=await engine.login(a.email,'synthetic-password');await engine.logout(second.token);assert.equal(await engine.read(second.token),null);
 });
});

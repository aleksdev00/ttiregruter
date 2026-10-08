import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';import type {Actor} from '../../src/server/access.ts';import {seed} from '../../src/adapters/demo/seed.ts';import {operation} from '../../src/server/operations.ts';import {loadSnapshot,workflowMutation} from '../../src/server/store.ts';import {mergeConfirmedSnapshot} from '../../src/domain/snapshot-patch.ts';import {privateReviewActor} from '../../src/server/private-review-bootstrap.ts';import type {Conversation} from '../../src/contracts/index.ts';
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_familiar_nemesis.sql','utf8'));sql.exec(readFileSync('drizzle/0001_flawless_frog_thor.sql','utf8'));sql.exec(readFileSync('drizzle/0003_lively_prowler.sql','utf8'));sql.exec(readFileSync('drizzle/0008_chilly_jack_murdock.sql','utf8'));sql.prepare('INSERT INTO store_revision VALUES(1,0)').run();const db={prepare(query:string){let args:unknown[]=[];return {bind(...v:unknown[]){args=v;return this;},async first(){return sql.prepare(query).get(...args as never[])??null;},async all(){return {results:sql.prepare(query).all(...args as never[])};},async run(){const result=sql.prepare(query).run(...args as never[]);return {meta:{changes:Number(result.changes)}};}};},async batch(statements:{run:()=>Promise<unknown>}[]){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 const actor=(id:string,role:Actor['role']='recruiter'):Actor=>({id,userId:'user-'+id,email:id+'@fixture.invalid',role,profile:{...seed().recruiter,id,fullName:id,alias:id,isDemo:false}});const a=actor('a'),b=actor('b'),admin=actor('admin','owner');for(const user of [a,b,admin])sql.prepare('INSERT INTO recruiters(id,user_id,email,role,active,data_json) VALUES(?,?,?,?,1,?)').run(user.id,user.userId,user.email,user.role,JSON.stringify(user.profile));return {sql,db,a,b,admin};}

test('Private initialization seeds 500 synthetic contacts for Aleksa, preserves refresh and forbids another user binding',async()=>{
 const f=fixture(),a=await privateReviewActor(f.db,{userId:'private-aleksa',email:'cvetanovicaleksa45@gmail.com'});
 assert.equal((await loadSnapshot(f.db,a)).contacts.length,500);assert.equal((await loadSnapshot(f.db,a)).contacts.every(c=>c.isDemo),true);
 await privateReviewActor(f.db,{userId:'private-aleksa',email:'cvetanovicaleksa45@gmail.com'});assert.equal((await loadSnapshot(f.db,a)).contacts.length,500);
 await assert.rejects(privateReviewActor(f.db,{userId:'other-user',email:'other@example.invalid'}));assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('Named private test accounts keep distinct identities and recruiter role restrictions',async()=>{
 const f=fixture(),aleks=await privateReviewActor(f.db,{userId:'private-aleksa',email:'cvetanovicaleksa45@gmail.com'}),lazar=await privateReviewActor(f.db,{userId:'private-lazar',email:'lakikiller09@gmail.com'}),nate=await privateReviewActor(f.db,{userId:'private-nate',email:'mikicn956@gmail.com'});
 assert.equal(aleks.role,'admin');assert.equal(lazar.role,'recruiter');assert.equal(nate.role,'recruiter');assert.notEqual(lazar.id,nate.id);assert.equal((await loadSnapshot(f.db,lazar)).contacts.length,0);assert.equal((await loadSnapshot(f.db,nate)).contacts.length,0);
 await assert.rejects(privateReviewActor(f.db,{userId:'private-lazar',email:'mikicn956@gmail.com'}));
});

test('Scoped saves confirm identical database state with one contact instead of 500; patches preserve other contacts and retries',async()=>{
 const f=fixture(),a=await privateReviewActor(f.db,{userId:'private-aleksa',email:'cvetanovicaleksa45@gmail.com'});
 const initial=await loadSnapshot(f.db,a),claim=await workflowMutation(f.db,a,'claimContact',['TEST-0001',{requestId:'private-claim-1'}],true);assert.equal(claim.ok,true);const c=(claim as {value:Conversation}).value;
 const method='saveCallNotes',args=[c.id,{...c.playbook!.notes,nextAction:'Private persisted note'},{requestId:'private-note-001',expectedRevision:c.revision}];
 const started=performance.now(),result=await workflowMutation(f.db,a,method,args,true),elapsed=performance.now()-started;assert.equal(result.ok,true);
 const patch=await loadSnapshot(f.db,a,{contactId:'TEST-0001',conversationId:c.id}),full=await loadSnapshot(f.db,a),merged=mergeConfirmedSnapshot(initial,patch);
 assert.equal(patch.contacts.length,1);assert.equal(full.contacts.length,500);assert.equal(merged.contacts.length,500);assert.deepEqual(merged.conversations,full.conversations);assert.deepEqual(merged.events,full.events);assert.deepEqual(merged.contacts.find(x=>x.id==='TEST-0001'),full.contacts.find(x=>x.id==='TEST-0001'));
 assert.deepEqual(await workflowMutation(f.db,a,method,args,true),result);assert.equal((await loadSnapshot(f.db,a)).conversations[0].playbook!.notes.nextAction,'Private persisted note');
 const fullBytes=new TextEncoder().encode(JSON.stringify(full)).length,patchBytes=new TextEncoder().encode(JSON.stringify(patch)).length;
 assert.ok(patchBytes<fullBytes/5);console.log(JSON.stringify({privateBenchmark:{syntheticContacts:500,scopedContacts:1,fullBytes,patchBytes,scopedSaveLocalMs:Math.round(elapsed*100)/100}}));
 await assert.rejects(workflowMutation(f.db,f.b,'saveCallNotes',args,true));
 const next=await workflowMutation(f.db,a,'claimContact',['TEST-0002',{requestId:'private-block-next'}],true);assert.equal(next.ok,false);
});

test('Snapshot patches reject another recruiter and external integrations are blocked by private worker allowlist',()=>{
 const s=seed();assert.throws(()=>mergeConfirmedSnapshot(s,{...s,recruiter:{...s.recruiter,id:'foreign'}}));
 const worker=readFileSync('build/sites-worker.ts','utf8'),route=readFileSync('app/api/workflow/route.ts','utf8');assert.ok(worker.includes("path.startsWith('/api/')&&!allowed.has(path)"));assert.ok(!route.includes('deliverCompletion'));assert.ok(!worker.includes('HQ_WEBHOOK'));assert.ok(worker.includes('productionDatabase:'));
});

test('Client consumes a confirmed database patch without another GET and explicit refresh still reads the server',async()=>{
 const {ServerRepository}=await import('../../src/adapters/server/repository.ts');const original=globalThis.fetch;let requests=0;const initial=seed(),patch={...initial,contacts:[{...initial.contacts[0],status:'reserved' as const}]};
 globalThis.fetch=(async(_input:unknown,init?:RequestInit)=>{requests++;return Response.json(init?.method==='POST'?{ok:true,value:{saved:true},snapshotPatch:patch,privateMetrics:{serverMs:1}}:{ok:true,value:initial});}) as typeof fetch;
 try{const repo=new ServerRepository();await repo.load();await repo.invoke('saveCallNotes',[]);const confirmed=await repo.load();assert.equal(requests,2);assert.equal(confirmed.ok,true);if(confirmed.ok)assert.equal(confirmed.value.contacts[0].status,'reserved');await repo.load();assert.equal(requests,3);}finally{globalThis.fetch=original;}
});

test('A failed save never manufactures a confirmed snapshot',async()=>{
 const {ServerRepository}=await import('../../src/adapters/server/repository.ts');const original=globalThis.fetch;let requests=0;globalThis.fetch=(async(_input:unknown,init?:RequestInit)=>{requests++;return Response.json(init?.method==='POST'?{ok:false,code:'storage_failed',message:'Unconfirmed save'}:{ok:true,value:seed()});}) as typeof fetch;
 try{const repo=new ServerRepository();await repo.load();const result=await repo.invoke('saveCallNotes',[]);assert.equal(result.ok,false);await repo.load();assert.equal(requests,3);}finally{globalThis.fetch=original;}
});

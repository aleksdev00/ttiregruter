Warning: truncated output (original token count: 34053)
Total output lines: 765

import {applyRequestedLaptopDemoContacts} from '../fixtures/requested-laptop-demo-contacts.ts';
import {applyRequestedDemoRemoval,applyRequestedAllDemoRemoval,applyRequestedAlexLaptopDemoRemoval} from '../../src/server/requested-demo-removal.ts';
import {assignedContactView,nextAvailableContact} from '../../src/domain/contact-list.ts';
import {applyOwnerReferrals,ownerReferralLinks,matchOwnerReferrals} from '../../src/server/owner-referral-links.ts';
import {applyRequestedAlexDemoContacts} from '../fixtures/requested-demo-contacts.ts';
import {releaseImportedContacts} from '../../src/server/contact-readiness.ts';
import {ownerCatalog} from '../../src/content/carrier-catalog/ownerCatalog.ts';
import {completionRequestId} from '../../src/domain/operation.ts';
import {submitApplication,applicationDelivery} from '../../src/server/application-submission.ts';
import {test} from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {resolveActor,type Actor,normalizePhone} from '../../src/server/access.ts';
import {operation,dossier,overview} from '../../src/server/operations.ts';import {loadSnapshot,workflowMutation,guardedBatch,currentRevision} from '../../src/server/store.ts';
import {seed} from '../../src/adapters/demo/seed.ts';import {ownerCatalogSource} from '../../src/content/carrier-catalog/ownerCatalog.ts';import {transfer,transferStatuses} from '../../src/server/transfer.ts';import {verifyQuo,ingestQuo} from '../../src/server/quo.ts';import {financialSummary} from '../../src/domain/finance.ts';import {validateGuideAnswer} from '../../src/domain/guide.ts';import type {Result,Conversation,Offer} from '../../src/contracts/index.ts';
import {persistInternalRouting} from '../../src/server/team-routing.ts';
import {mergeConfirmedSnapshot} from '../../src/domain/snapshot-patch.ts';
import {prepareContactMigration,commitContactMigration,verifyContactMigration,LEGACY_SOURCE,WORKBOOK_SOURCE,mapLegacyContacts,prepareRecruiterStubs,type Manifest} from '../../src/server/contact-migration.ts';
import {saveLines,allocateLine,lineOverview,useLineForCurrentAdmin} from '../../src/server/quo-lines.ts';
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('drizzle/0000_familiar_nemesis.sql','utf8'));sql.exec(readFileSync('drizzle/0001_flawless_frog_thor.sql','utf8'));sql.exec(readFileSync('drizzle/0003_lively_prowler.sql','utf8'));sql.exec(readFileSync('drizzle/0008_chilly_jack_murdock.sql','utf8'));sql.prepare('INSERT INTO store_revision VALUES(1,0)').run();const db={prepare(query:string){let args:unknown[]=[];return {bind(...v:unknown[]){args=v;return this;},async first(){return sql.prepare(query).get(...args as never[])??null;},async all(){return {results:sql.prepare(query).all(...args as never[])};},async run(){const result=sql.prepare(query).run(...args as never[]);return {meta:{changes:Number(result.changes)}};}};},async batch(statements:{run:()=>Promise<unknown>}[]){sql.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 const actor=(id:string,role:Actor['role']='recruiter'):Actor=>({id,userId:'user-'+id,email:id+'@fixture.invalid',role,profile:{...seed().recruiter,id,fullName:id,alias:id,isDemo:false}});const a=actor('a'),b=actor('b'),admin=actor('admin','owner');for(const user of [a,b,admin])sql.prepare('INSERT INTO recruiters(id,user_id,email,role,active,data_json) VALUES(?,?,?,?,1,?)').run(user.id,user.userId,user.email,user.role,JSON.stringify(user.profile));return {sql,db,a,b,admin};}
const ok=<T>(r:Result<T>)=>{assert.equal(r.ok,true,JSON.stringify(r));return (r as {ok:true;value:T}).value;};
// Construct historical practice records only in the private in-memory test database.
async function fixturePracticeDrivers(f:ReturnType<typeof fixture>){
 const profiles=f.sql.prepare('SELECT id FROM recruiters WHERE active=1 ORDER BY id').all();let serial=100;
 for(const profile of profiles)for(let i=0;i<5;i++){
  const id='fixture-demo:'+profile.id+':'+i,phone='+1202555'+String(serial++).padStart(4,'0');
  const contact={id,firstName:'Demo',lastName:'Fixture Driver',nameEvidence:'explicit_source',phoneRaw:phone,phoneNormalized:phone,email:null,city:null,state:null,sourceLabel:'Synthetic in-memory fixture',sourceRecordId:id,status:'available',ownerRecruiterId:profile.id,reservedBy:null,activeConversationId:null,callbackAt:null,rawFields:{demo_contact:true},isDemo:true};
  f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,0,0,?,?)').run(id,String(profile.id),phone,'Synthetic fixture',JSON.stringify(contact));
 }
}
test('Owner-confirmed source workbook approval is projected into recruiter offers without claiming current terms verified',async()=>{const f=fixture(),offer={...seed().offers[0],id:'owner-imported',source:'google_sheet',active:false,approvalStatus:'pending_review',recruitingApproved:false,verifiedAt:null};f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').run('source-company',offer.companyName,'pending_review',1,JSON.stringify({sourceHash:ownerCatalogSource.sha256}));f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(offer.id,'source-company','1',JSON.stringify(offer));const projected=(await loadSnapshot(f.db,f.a)).offers[0];assert.equal(projected.approvalStatus,'approved');assert.equal(projected.recruitingApproved,true);assert.equal(projected.active,true);assert.equal(projected.verifiedAt,null);});
test('All roles are denied demo creation and no contacts are added',async()=>{const f=fixture();for(const actor of [f.admin,f.a,f.b])await assert.rejects(operation(f.db,actor,'seed_demo_contacts',{requestId:'forbidden-demo'}),/seeding is disabled/);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,0);});
test('Finishing a demo practice driver does not create a real completion email notification',async()=>{const f=fixture();await fixturePracticeDrivers(f);const id=String(f.sql.prepare("SELECT id FROM drivers WHERE owner_id='a' AND json_extract(data_json,'$.isDemo')=1 ORDER BY id LIMIT 1").get()!.id);const c=ok(await workflowMutation(f.db,f.a,'claimContact',[id,{requestId:'demo-claim'}])) as Conversation;ok(await workflowMutation(f.db,f.a,'recordAttempt',[c.id,{requestId:'demo-attempt'}]));ok(await workflowMutation(f.db,f.a,'conversationAction',[c.id,'interested',{requestId:'demo-interested'}]));ok(await workflowMutation(f.db,f.a,'saveAnswers',[c.id,{safeToTalk:true},'guide_position',{requestId:'demo-safe'}]));ok(await workflowMutation(f.db,f.a,'finish',[c.id,'interested',null,{requestId:'demo-finish'}]));assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);});
test('Quo line profiles reserve disjoint contact batches without login, status changes or repeat allocation',async()=>{
 const f=fixture(),objects=new Map<string,string>(),bucket={async put(k:string,v:string){objects.set(k,v);},async head(k:string){return objects.has(k)?{}:null;}} as unknown as R2Bucket;
 const roster={lines:[{id:'PNtestone',name:'First test line',number:'+12025550111'},{id:'PNtesttwo',name:'Second test line',number:'+12025550112'}]};
 await assert.rejects(saveLines(f.db,bucket,f.a,roster));await saveLines(f.db,bucket,f.admin,roster);
 for(let i=0;i<7;i++){const c={id:'import-'+i,firstName:'Test',lastName:'Driver',nameEvidence:'explicit_source',phoneNormalized:'+1202555020'+i,phoneRaw:'+1202555020'+i,status:i===6?'do_not_contact':'closed',ownerRecruiterId:null,reservedBy:null,activeConversationId:null,rawFields:{legacy_source_project:WORKBOOK_SOURCE,notes:'Preserved fixture notes'}};f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,NULL,?,?,0,?,?)').run(c.id,c.phoneNormalized,i===6?1:0,'Owner review',JSON.stringify(c));}
 const before=f.sql.prepare('SELECT data_json FROM drivers ORDER BY id').all();
 const first={lineId:'PNtestone',target:3,requestId:crypto.randomUUID()};await allocateLine(f.db,bucket,f.admin,first);await allocateLine(f.db,bucket,f.admin,first);await allocateLine(f.db,bucket,f.admin,{...first,requestId:crypto.randomUUID()});
 await allocateLine(f.db,bucket,f.admin,{lineId:'PNtesttwo',target:3,requestId:crypto.randomUUID()});
 const overview=await lineOverview(f.db,f.admin);assert.equal((overview.counts as {total:number}).total,6);assert.ok(overview.lines.every(l=>l.allocated===3&&l.recruiter_id===null));
 assert.deepEqual(f.sql.prepare('SELECT data_json FROM drivers ORDER BY id').all(),before);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM recruiters').get()!.n,3);
 assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM quo_line_allocations WHERE driver_id='import-6'").get()!.n,0);
 await assert.rejects(allocateLine(f.db,bucket,f.admin,{lineId:'PNtestone',target:4,requestId:crypto.randomUUID()}));
 const next=await operation(f.db,f.admin,'assign_batch',{recruiterId:f.a.id,count:10,reason:'Fixture allocation check',requestId:'normal-after-lines'}) as {assigned:number};assert.equal(next.assigned,0);
 await assert.rejects(operation(f.db,f.admin,'reassign',{driverId:'import-0',expectedOwner:null,nextOwner:f.a.id,reason:'Fixture collision',requestId:'reserved-reassign'}));
 assert.ok(objects.size>=4);
 const adminA={...f.a,role:'admin' as const};f.sql.prepare("UPDATE recruiters SET role='admin' WHERE id=?").run(f.a.id);
 await assert.rejects(useLineForCurrentAdmin(f.db,bucket,f.b,{lineId:'PNtestone',requestId:crypto.randomUUID()}));
 await assert.rejects(useLineForCurrentAdmin(f.db,bucket,f.admin,{lineId:'PNtestone',requestId:crypto.randomUUID()}));
 f.sql.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact') WHERE id='import-0'").run();
 const request={lineId:'PNtestone',requestId:crypto.randomUUID()};await useLineForCurrentAdmin(f.db,bucket,adminA,request);await useLineForCurrentAdmin(f.db,bucket,adminA,request);
 const actual=await resolveActor(f.db,{userId:f.a.userId,email:f.a.email});assert.equal(actual.role,'admin');assert.equal(actual.profile.fullName,'First test line');assert.equal(actual.profile.alias,'First test line');assert.equal(actual.profile.callbackNumber,'+12025550111');
 assert.equal((await loadSnapshot(f.db,actual)).contacts.length,3);assert.equal((await loadSnapshot(f.db,actual)).recruiter.accountRole,'admin');assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM recruiters').get()!.n,3);
 const restricted=f.sql.prepare("SELECT blocked,owner_id,data_json FROM drivers WHERE id='import-0'").get()!;assert.equal(restricted.blocked,1);assert.equal(restricted.owner_id,f.a.id);assert.equal(JSON.parse(String(restricted.data_json)).status,'do_not_contact');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers WHERE owner_id=?').get(f.a.id)!.n,3);assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM drivers d JOIN quo_line_allocations x ON x.driver_id=d.id WHERE x.line_id='PNtesttwo' AND d.owner_id IS NULL").get()!.n,3);
 await assert.rejects(useLineForCurrentAdmin(f.db,bucket,adminA,{lineId:'PNtesttwo',requestId:crypto.randomUUID()}));
});
async function newDriver(f:ReturnType<typeof fixture>,actor=f.a,phone='+12025550191'){return (await operation(f.db,actor,'create_driver',{name:'Fictional Driver',phone,email:'',nextAction:'Agreed test conversation.'}) as {id:string}).id;}
async function live(f:ReturnType<typeof fixture>){const id=await newDriver(f),c=ok(await workflowMutation(f.db,f.a,'claimContact',[id,{requestId:'fixture-claim'}])) as Conversation;await workflowMutation(f.db,f.a,'recordAttempt',[c.id,{requestId:'fixture-attempt'}]);await workflowMutation(f.db,f.a,'conversationAction',[c.id,'interested',{requestId:'fixture-interested'}]);await workflowMutation(f.db,f.a,'saveAnswers',[c.id,{safeToTalk:true},'guide_position',{requestId:'fixture-safe'}]);return {id,c};}
test('Scoped workflow saves return a small confirmed patch and preserve the full client snapshot',async()=>{const f=fixture(),template=seed().contacts[0];for(let i=0;i<500;i++){const id=`PERF-${String(i).padStart(4,'0')}`,phone=`+1312555${String(1000+i).slice(-4)}`,contact={...template,id,phoneRaw:phone,phoneNormalized:phone,ownerRecruiterId:f.a.id,status:'available' as const,isDemo:false,activeConversationId:null};f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,batch_id,next_action,data_json) VALUES(?,?,?,0,0,NULL,?,?)').run(id,f.a.id,phone,'Continue recruiter conversation',JSON.stringify(contact));}const initial=await loadSnapshot(f.db,f.a),contactId='PERF-0000',c=ok(await workflowMutation(f.db,f.a,'claimContact',[contactId,{requestId:'perf-claim'}],true)) as Conversation;const result=await workflowMutation(f.db,f.a,'saveCallNotes',[c.id,{...c.playbook!.notes,nextAction:'Saved scoped note'},{requestId:'perf-note',expectedRevision:c.revision}],true);ok(result);const patch=await loadSnapshot(f.db,f.a,{contactId,conversationId:c.id}),full=await loadSnapshot(f.db,f.a),merged=mergeConfirmedSnapshot(initial,patch);assert.equal(initial.contacts.length,500);assert.equal(patch.contacts.length,1);assert.equal(full.contacts.length,500);assert.equal(merged.contacts.length,500);assert.deepEqual(merged.conversations,full.conversations);assert.deepEqual(merged.events,full.events);assert.deepEqual(merged.contacts.find(x=>x.id===contactId),full.contacts.find(x=>x.id===contactId));assert.ok(new TextEncoder().encode(JSON.stringify(patch)).length<new TextEncoder().encode(JSON.stringify(full)).length/5);});
test('A database-confirmed workflow patch skips the redundant snapshot request',async()=>{const {ServerRepository}=await import('../../src/adapters/server/repository.ts'),original=globalThis.fetch,initial=seed(),patch={...initial,contacts:[{...initial.contacts[0],status:'reserved' as const}]};let requests=0;globalThis.fetch=(async(_input:unknown,init?:RequestInit)=>{requests++;return Response.json(init?.method==='POST'?{ok:true,value:{saved:true},snapshotPatch:patch}:{ok:true,value:initial});}) as typeof fetch;try{const repository=new ServerRepository();await repository.load();await repository.invoke('saveCallNotes',[]);const confirmed=await repository.load();assert.equal(requests,2);assert.equal(confirmed.ok,true);if(confirmed.ok)assert.equal(confirmed.value.contacts[0].status,'reserved');await repository.load();assert.equal(requests,3);}finally{globalThis.fetch=original;}});
test('Completion keys accept callback timestamps and remain stable for retries',async()=>{
 const date='2030-10-03T15:00:00.000Z',key=await completionRequestId('synthetic-conversation','callback',date);
 assert.match(key,/^[-\w]{8,160}$/);assert.equal(key,await completionRequestId('synthetic-conversation','callback',date));
 assert.notEqual(key,await completionRequestId('synthetic-conversation','callback','2030-10-04T15:00:00.000Z'));
 assert.notEqual(key,await completionRequestId('synthetic-conversation','not_interested',null));
});
test('Clearing an outcome saves null and invalid draft values never poison later writes',async()=>{
 const f=fixture(),{c}=await live(f);
 ok(await workflowMutation(f.db,f.a,'saveOutcomeDraft',[c.id,'interested',null,{requestId:'draft-interest'}]));
 for(const outcome of ['', 'unsupported', false]){
  const result=await workflowMutation(f.db,f.a,'saveOutcomeDraft',[c.id,outcome,null,{requestId:'draft-invalid-'+String(outcome)}]);
  assert.equal(result.ok,false);
 }
 ok(await workflowMutation(f.db,f.a,'saveOutcomeDraft',[c.id,null,null,{requestId:'draft-clear'}]));
 ok(await workflowMutation(f.db,f.a,'pause',[c.id,{requestId:'draft-pause'}]));
 const saved=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;
 assert.equal(saved.playbook?.flow?.outcomeDraft.outcome,null);assert.equal(saved.status,'paused');
 assert.equal(saved.answers.safeToTalk,true);
});
test('Legacy blank outcome recovers on save without losing answers, notes, or callback drafts',async()=>{
 const f=fixture(),{c}=await live(f),callback='2030-10-03T15:00';
 ok(await workflowMutation(f.db,f.a,'saveOutcomeDraft',[c.id,null,callback,{requestId:'legacy-draft'}]));
 f.sql.prepare("UPDATE conversations SET data_json=json_set(data_json,'$.playbook.flow.outcomeDraft.outcome','') WHERE id=?").run(c.id);
 ok(await workflowMutation(f.db,f.a,'pause',[c.id,{requestId:'legacy-recover'}]));
 let saved=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;
 assert.equal(saved.status,'paused');assert.equal(saved.playbook?.flow?.outcomeDraft.outcome,null);
 assert.equal(saved.playbook?.flow?.outcomeDraft.callbackAt,callback);assert.equal(saved.answers.safeToTalk,true);
 ok(await workflowMutation(f.db,f.a,'resume',[c.id,{requestId:'legacy-resume'}]));
 ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'position','Company driver','',{requestId:'legacy-edit'}]));
 saved=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;
 assert.equal(saved.playbook?.guide?.answers.position,'Company driver');assert.equal(saved.status,'active');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
});
test('Callback completion persists after reload and duplicate retry creates one follow-up',async()=>{
 const f=fixture(),{id,c}=await live(f),date=new Date(Date.now()+86400000).toISOString();
 const current=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;
 await assert.rejects(workflowMutation(f.db,f.a,'finish',[c.id,'callback',date,{requestId:`playbook-finish-${c.id}-callback-${date}`,expectedRevision:current.revision}]),/stable request ID/);
 assert.equal((await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!.status,'active');
 const args=[c.id,'callback',date,{requestId:await completionRequestId(c.id,'callback',date),expectedRevision:current.revision}];
 ok(await workflowMutation(f.db,f.a,'finish',args));ok(await workflowMutation(f.db,f.a,'finish',args));
 const reloaded=await loadSnapshot(f.db,f.a),saved=reloaded.conversations.find(x=>x.id===c.id)!,contact=reloaded.contacts.find(x=>x.id===id)!;
 assert.equal(saved.status,'closed');assert.equal(saved.outcome,'callback');assert.equal(contact.status,'callback_due');assert.equal(contact.callbackAt,date);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM tasks WHERE driver_id=?').get(id)!.n,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
});
test('Server identity rejects anonymous, unapproved, mismatched and deactivated accounts',async()=>{const f=fixture();await assert.rejects(resolveActor(f.db,null));await assert.rejects(resolveActor(f.db,{userId:f.a.userId,email:f.b.email}));assert.equal((await resolveActor(f.db,{userId:f.a.userId,email:f.a.email})).id,f.a.id);f.sql.prepare('UPDATE recruiters SET active=0 WHERE id=?').run(f.a.id);await assert.rejects(resolveActor(f.db,{userId:f.a.userId,email:f.a.email}));});
test('Approved bootstrap binds Site-scoped identity with TTI owner and Aleksa admin, without synthetic contacts',async()=>{
 const f=fixture();f.sql.exec('DELETE FROM recruiters');
 await assert.rejects(resolveActor(f.db,{userId:'unknown-site-user',email:'unknown@fixture.invalid'}));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM recruiters').get()!.n,0);
 const aleksa=await resolveActor(f.db,{userId:'actual-site-aleksa',email:'cvetanovicaleksa45@gmail.com'});
 assert.equal(aleksa.role,'admin');assert.equal(aleksa.userId,'actual-site-aleksa');assert.equal(aleksa.profile.isDemo,false);
 const pending=f.sql.prepare("SELECT role,user_id FROM recruiters WHERE email='tticdlrecruiting@gmail.com'").get()!;
 assert.equal(pending.role,'owner');assert.equal(pending.user_id,null);
 const owner=await resolveActor(f.db,{userId:'actual-site-owner',email:'TTICDLRECRUITING@gmail.com'});
 assert.equal(owner.role,'owner');assert.equal(owner.userId,'actual-site-owner');
 await assert.rejects(resolveActor(f.db,{userId:'different-site-id',email:aleksa.email}));
 f.sql.prepare('UPDATE recruiters SET active=0 WHERE id=?').run(aleksa.id);
 await assert.rejects(resolveActor(f.db,{userId:aleksa.userId,email:aleksa.email}));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,0);
});
test('Direct dossier, workflow IDs and scoped lists never expose another recruiter',async()=>{const f=fixture(),id=await newDriver(f);assert.equal((await loadSnapshot(f.db,f.b)).contacts.length,0);await assert.rejects(dossier(f.db,f.b,id),e=>e instanceof Error&&!e.message.includes(f.a.email));await assert.rejects(workflowMutation(f.db,f.b,'claimContact',[id,{requestId:'foreign-claim'}]));assert.equal((await dossier(f.db,f.admin,id)).contact.ownerRecruiterId,f.a.id);await assert.rejects(operation(f.db,f.b,'create_driver',{name:'Changed',phone:'+12025550191',email:'',nextAction:'Call'}));assert.equal((await dossier(f.db,f.a,id)).contact.firstName,'Fictional');});
test('New driver ownership and duplicate detection normalize US phone formats',async()=>{const f=fixture(),id=await newDriver(f);assert.equal(normalizePhone('(202) 555-0191'),'+12025550191');assert.equal((await dossier(f.db,f.a,id)).contact.ownerRecruiterId,f.a.id);assert.equal(await newDriver(f,f.a,'202-555-0191'),id);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,1);});
test('A stale CAS writer rolls back records and audit together',async()=>{const f=fixture(),id=await newDriver(f),revision=await currentRevision(f.db);await guardedBatch(f.db,revision,[f.db.prepare('UPDATE drivers SET next_action=? WHERE id=?').bind('First',id)]);await assert.rejects(guardedBatch(f.db,revision,[f.db.prepare('UPDATE drivers SET next_action=? WHERE id=?').bind('Second',id)]));assert.equal(f.sql.prepare('SELECT next_action FROM drivers WHERE id=?').get(id)!.next_action,'First');});
test('Atomic batch assignment excludes DNC, duplicates and owners; replay does not assign again',async()=>{const f=fixture();for(let i=0;i<1100;i++){const d={...seed().contacts[0],id:'unassigned-'+i,phoneNormalized:'+1202'+String(i).padStart(7,'0'),ownerRecruiterId:null,isDemo:false};f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,NULL,?,?,?,\'Review\',?)').run(d.id,d.phoneNormalized,i===0?1:0,i===1?1:0,JSON.stringify(d));}const input={recruiterId:f.a.id,count:500,reason:'Synthetic assignment',requestId:'fixture-batch-a'};const first=await operation(f.db,f.admin,'assign_batch',input) as {assigned:number};assert.equal(first.assigned,500);assert.equal((await operation(f.db,f.admin,'assign_batch',input) as {assigned:number}).assigned,500);await operation(f.db,f.admin,'assign_batch',{...input,recruiterId:f.b.id,requestId:'fixture-batch-b'});assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers WHERE owner_id=?').get(f.a.id)!.n,500);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers WHERE owner_id=?').get(f.b.id)!.n,500);assert.equal(f.sql.prepare('SELECT owner_id FROM drivers WHERE id=\'unassigned-0\'').get()!.owner_id,null);});
test('Reassignment audit is atomic, idempotent and old owner loses access including receipt replay',async()=>{const f=fixture(),id=await newDriver(f);const input={driverId:id,expectedOwner:f.a.id,nextOwner:f.b.id,reason:'Synthetic owner change',requestId:'fixture-owner'};await operation(f.db,f.admin,'reassign',input);await operation(f.db,f.admin,'reassign',input);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM audit WHERE type=\'ownership_changed\'').get()!.n,1);await assert.rejects(dossier(f.db,f.a,id));assert.equal((await dossier(f.db,f.b,id)).contact.ownerRecruiterId,f.b.id);await assert.rejects(operation(f.db,f.admin,'reassign',{...input,requestId:'new-request'}));});
test('Response-driven server workflow persists refresh, exact question, W2 path editing and DNC',async()=>{const f=fixture(),{id,c}=await live(f);await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'position','Company driver','',{requestId:'fixture-pos'}]);await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'employmentType','W-2','',{requestId:'fixture-w2'}]);await workflowMutation(f.db,f.a,'saveAnswers',[c.id,{},'guide_position',{requestId:'fixture-edit'}]);let loaded=(await loadSnapshot(f.db,f.a)).conversations[0];assert.equal(loaded.activeStepId,'guide_position');await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'employmentType','1099','',{requestId:'fixture-1099'}]);await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'state','IL','',{requestId:'fixture-state'}]);loaded=(await loadSnapshot(f.db,f.a)).conversations[0];assert.equal(loaded.activeStepId,'guide_locationZip');assert.equal((await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'locationZip','@@@ -5','',{requestId:'fixture-invalid'}])).ok,false);await workflowMutation(f.db,f.a,'conversationAction',[c.id,'do_not_contact',{requestId:'fixture-dnc'}]);await assert.rejects(workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'locationZip','Chicago | 60608','',{requestId:'fixture-after-dnc'}]));await workflowMutation(f.db,f.a,'finish',[c.id,'do_not_contact',null,{requestId:'fixture-finish'}]);assert.equal((await dossier(f.db,f.a,id)).contact.status,'do_not_contact');});
test('Typed city, ZIP, experience and pay basis reject malformed values',()=>{assert.ok(validateGuideAnswer('locationZip','@@@ -5',''));assert.equal(validateGuideAnswer('locationZip','Chicago | 60608',''),null);assert.ok(validateGuideAnswer('experienceMonths','-1',''));assert.ok(validateGuideAnswer('payTarget','1800',''));assert.equal(validateGuideAnswer('payTarget','1800 | take_home | weekly',''),null);});
async function applicationFixture(){const f=fixture(),{id,c}=await live(f);const answers={position:'Company driver',employmentType:'1099',state:'IL',locationZip:'Chicago | 60608',experienceMonths:'24',sap:'no',trailer:'Dry van',truck:'Volvo',route:'Regional',home:'7',payTarget:'1800 | gross | weekly',availability:'Two weeks',priority:'Home time',dealbreakers:'No forced dispatch'};for(const [q,value] of Object.entries(answers))ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,q,value,'',{requestId:'fixture-'+q}]));const offer:Offer={...seed().offers[1],id:'fixture-offer',companyName:'Fictional Verified Carrier',employment:'1099',isDemo:false,source:'approved_snapshot',active:true,approvalStatus:'approved',recruitingApproved:true,verifiedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z',hiringStates:['IL'],requiredLicense:'A',minExperienceMonths:12,routeType:'regional',homeTime:'weekly',requirements:['position','sap','trailer','truck','payTarget','availability','dealbreakers'].map(field=>({field:field as keyof typeof answers,kind:'hard',operator:'in',values:[answers[field as keyof typeof answers]],label:field}))};await operation(f.db,f.admin,'save_catalog',{companyId:'fixture-company',companyName:offer.companyName,status:'active',expectedVersion:0,offer,verifiedBy:f.admin.id,source:'Synthetic documented test fixture'});ok(await workflowMutation(f.db,f.a,'selectOffer',[c.id,offer.id,{requestId:'fixture-select'}]));ok(await workflowMutation(f.db,f.a,'conversationAction',[c.id,'application_next',{requestId:'fixture-next'}]));ok(await workflowMutation(f.db,f.a,'conversationAction',[c.id,'agree_to_apply',{requestId:'fixture-agree'}]));const result=await operation(f.db,f.a,'finalize_internal',{conversationId:c.id,offerVersion:'1',requestId:'fixture-finalize'}) as {applicationId:string};return {...f,id,c,offer,appId:result.applicationId};}
test('Finalization snapshots exact terms, separate applications, one choice and idempotent transfer key',async()=>{const f=await applicationFixture();const repeated=await operation(f.db,f.a,'finalize_internal',{conversationId:f.c.id,offerVersion:'1',requestId:'another-click'}) as {applicationId:string};assert.equal(repeated.applicationId,f.appId);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,1);const summary=await overview(f.db,f.a);assert.equal(summary.applications.length,1);await assert.rejects(operation(f.db,f.b,'finalize_internal',{conversationId:f.c.id,offerVersion:'1',requestId:'foreign-finalize'}));});
test('Changed and paused offers cannot be finalized against old terms',async()=>{const f=await applicationFixture();await operation(f.db,f.admin,'save_catalog',{companyId:'fixture-company',companyName:f.offer.companyName,status:'paused',expectedVersion:1,offer:f.offer,verifiedBy:f.admin.id,source:'Updated synthetic terms'});await assert.rejects(operation(f.db,f.a,'finalize_internal',{conversationId:f.c.id,offerVersion:'1',requestId:'changed-finalize'}));});
test('HQ partial writes, lost response, notification status and concurrency reuse the same application',async()=>{const f=await applicationFixture(),config={enabled:true,mappingVerified:true,url:'https://script.google.com/macros/s/fixture/exec',secret:'local-fixture-secret'};let calls=0;const send=(async(_url:unknown,options:RequestInit)=>{calls++;assert.equal(JSON.parse(String(options.body)).applicationId,f.appId);if(calls===1)return Response.json({ok:false,hq:{ok:true,recordId:f.appId},crm:{ok:false},notification:{status:'failed'}});return Response.json({ok:true,hq:{ok:true,recordId:f.appId},crm:{ok:true,recordId:f.appId},notification:{status:'failed'}});}) as typeof fetch;assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,false);assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,true);assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,true);assert.equal(calls,2);assert.equal(f.sql.prepare('SELECT notification FROM applications WHERE id=?').get(f.appId)!.notification,'failed');f.sql.prepare('UPDATE applications SET hq=\'pending\',crm=\'pending\',lease_token=\'held\',lease_at=? WHERE id=?').run(Date.now(),f.appId);assert.equal((await transfer(f.db,f.a,f.appId,config,send)).processing,true);assert.equal(calls,2);assert.equal(transferStatuses({hq:'pending',crm:'pending',notification:'disabled'},f.appId,{hq:{ok:true,recordId:'wrong'},crm:{ok:true,recordId:f.appId}}).synced,false);});
test('Legacy transfer uses approved snapshot and correlates readback on retries',async()=>{
 const f=await applicationFixture();let calls=0;const send=(async(_url:unknown,options:RequestInit)=>{calls++;const p=JSON.parse(String(options.body));assert.equal(p.action,'completeApplication');assert.equal(p.idempotencyKey,f.appId);assert.equal(p.webhookSecret,'fixture-key');assert.equal(p.driver.phone,'+12025550191');assert.equal(p.driver.experienceMonths,24);return Response.json({ok:true,hq:{ok:true,rowNumber:9},crm:{ok:true,recordId:f.appId},email:{status:'SENT'}});}) as typeof fetch;
 const config={enabled:true,mappingVerified:true,url:'https://script.google.com/macros/s/fixture/exec',secret:'fixture-key',protocol:'legacy' as const,notificationAuthorized:true};
 assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,true);assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,true);assert.equal(calls,1);
});
test('Explicit submission preserves local application when legacy email is unauthorized',async()=>{
 const f=await applicationFixture();let probes=0,writes=0;
 const send=(async(_url:unknown,options:RequestInit)=>{const p=JSON.parse(String(options.body));if(p.action==='ttiConnectionCheck'){probes++;return Response.json({ok:false,error:p.webhookSecret==='fixture-key'?'Unsupported action.':'Unauthorized.'});}writes++;throw Error('No live business action allowed');}) as typeof fetch;
 const result=await submitApplication(f.db,f.a,{conversationId:f.c.id,offerVersion:'1',requestId:'submit-fixture'},{enabled:true,mappingVerified:false,url:'https://script.google.com/macros/s/fixture/exec',secret:'fixture-key',protocol:'legacy'},send);
 assert.equal(result?.state,'failed');assert.equal(result?.applicationId,f.appId);assert.match(result?.message??'',/emails tticdlrecruiting/);assert.equal(probes,2);assert.equal(writes,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,1);assert.equal((await applicationDelivery(f.db,f.a,f.c.id))?.state,'failed');
});
test('HTTP 200 failure cannot confirm delivery; retry reuses saved ID and confirms both readbacks',async()=>{
 const f=await applicationFixture(),config={enabled:true,mappingVerified:true,url:'https://script.google.com/macros/s/fixture/exec',secret:'fixture-key',protocol:'legacy' as const,notificationAuthorized:true};let calls=0;
 const send=(async(_url:unknown,options:RequestInit)=>{calls++;const p=JSON.parse(String(options.body));assert.equal(p.idempotencyKey,f.appId);assert.equal(p.recruiter.email,f.a.email);return Response.json({ok:calls>1,hq:{ok:true,rowNumber:9},crm:{ok:true,recordId:f.appId},email:{status:'DISABLED'}});}) as typeof fetch;
 assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,false);assert.equal((await applicationDelivery(f.db,f.a,f.c.id))?.state,'failed');
 assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,true);assert.equal((await applicationDelivery(f.db,f.a,f.c.id))?.state,'delivered');
 assert.equal((await transfer(f.db,f.a,f.appId,config,send)).synced,true);assert.equal(calls,2);
});
test('Non-application call outcomes persist queue restrictions and create no application or transfer attempts',async()=>{
 for(const outcome of ['callback','not_interested','do_not_contact'] as const){const f=fixture(),{id,c}=await live(f);ok(await workflowMutation(f.db,f.a,'finish',[c.id,outcome,outcome==='callback'?new Date(Date.now()+86400000).toISOString():null,{requestId:'no-application-'+outcome}]));assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM integration_attempts').get()!.n,0);const contact=(await loadSnapshot(f.db,f.a)).contacts.find(x=>x.id===id)!;assert.equal(contact.status,outcome==='callback'?'callback_due':outcome==='do_not_contact'?'do_not_contact':'closed');}
});
test('Lost delivery confirmation preserves the application and an overlapping retry cannot send twice',async()=>{
 const f=await applicationFixture(),config={enabled:true,mappingVerified:true,url:'https://script.google.com/macros/s/fixture/exec',secret:'fixture-key'};
 await transfer(f.db,f.a,f.appId,config,(async()=>{throw Error('Synthetic lost response');}) as typeof fetch);
 assert.equal((await applicationDelivery(f.db,f.a,f.c.id))?.state,'failed');assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,1);
 let signal!:()=>void,release!:(r:Response)=>void;const started=new Promise<void>(resolve=>{signal=resolve;}),response=new Promise<Response>(resolve=>{release=resolve;});let calls=0;
 const send=(async(_url:unknown,options:RequestInit)=>{calls++;assert.equal(JSON.parse(String(options.body)).applicationId,f.appId);signal();return response;}) as typeof fetch;
 const first=transfer(f.db,f.a,f.appId,config,send);await started;assert.equal((await transfer(f.db,f.a,f.appId,config,send)).processing,true);
 release(Response.json({ok:true,hq:{ok:true,recordId:f.appId},crm:{ok:true,recordId:f.appId},notification:{status:'disabled'}}));assert.equal((await first).synced,true);assert.equal(calls,1);
});
test('Pending application cannot send obsolete driver answers after an edit',async()=>{
 const f=await applicationFixture();ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[f.c.id,'experienceMonths','36','',{requestId:'updated-experience'}]));let sent=0;
 await assert.rejects(transfer(f.db,f.a,f.appId,{enabled:true,mappingVerified:true,url:'https://script.google.com/macros/s/fixture/exec',secret:'fixture-key'},(async()=>{sent++;return Response.json({ok:true});}) as typeof fetch),/answers or company agreement changed/);
 assert.equal(sent,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,1);
});
test('Internal routing uses the saved application timestamp and reopens the same review result',async()=>{
 const f=await applicationFixture();f.sql.exec(readFileSync('drizzle/0002_team_referral_export.sql','utf8'));
 assert.equal((await persistInternalRouting(f.db,f.a,f.appId))?.status,'needs_review');
 assert.equal((await persistInternalRouting(f.db,f.a,f.appId))?.status,'needs_review');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM export_deliveries WHERE application_id=?').get(f.appId)!.n,1);
});
function migrationFixture(){const objects=new Map<string,string>();const bucket={async put(key:string,value:string){objects.set(key,value);},async head(key:string){return objects.has(key)?{}:null;},async get(key:string){const value=objects.get(key);return value===undefined?null:{json:async()=>JSON.parse(value),body:value};}} as unknown as R2Bucket;const manifest:Manifest={schemaVersion:1,sourceProjectId:LEGACY_SOURCE,extractedAt:new Date().toISOString(),recruiters:[{id:'source-a',email:'a@fixture.invalid',display_name:'A',status:'active'},{id:'source-unlinked',email:'unlinked@fixture.invalid',display_name:'Unlinked',status:'active'}],driver_profiles:[{id:'legacy-one',first_name:'Synthetic',last_name:'Driver',phone_e164:'+12025550101',email:'driver@invalid.test',assigned_recruiter_id:'source-a',assigned_email:'a@fixture.invalid',lead_status:'new',notes:'Preserved notes',experience_months:24,created_at:100000,updated_at:200000},{id:'legacy-dnc',phone_e164:'+12025550102',assigned_email:'a@fixture.invalid',lead_status:'do_not_contact',contact_blocked:1,follow_up_at:Date.now()-1000},{id:'legacy-closed',phone_e164:'+12025550103',assigned_email:'a@fixture.invalid',lead_status:'hired',follow_up_at:Date.now()-1000}],owner_operator_contacts:[{phone_e164:'+12025550101',source_row:2,created_at:100000}],contact_batches:[{id:'batch-one',recruiter_id:'source-a',created_at:100000}],contact_batch_items:[{id:'item-one',batch_id:'batch-one',driver_profile_id:'legacy-one'}]};return {bucket,objects,manifest};}
test('Workbook import skips existing normalized phones and preserves original restrictions and newer edits',async()=>{
 const f=fixture(),m=migrationFixture();m.manifest.sourceProjectId=WORKBOOK_SOURCE;m.manifest.recruiters=[];m.manifest.owner_operator_contacts=[];m.manifest.contact_batches=[];m.manifest.contact_batch_items=[];
 const id=await newDriver(f,f.a,'+12025550102');f.sql.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact') WHERE id=?").run(id);
 const preview=await prepareContactMigration(f.db,m.bucket,f.admin,m.manifest);assert.equal(preview.summary.matched,1);assert.equal(preview.summary.expectedImports,2);await commitContactMigration(f.db,m.bucket,f.admin,preview.runId,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,3);const old=f.sql.prepare('SELECT blocked,data_json FROM drivers WHERE id=?').get(id)!;assert.equal(old.blocked,1);assert.equal(JSON.parse(String(old.data_json)).firstName,'Fictional');
 const verified=await verifyContactMigration(f.db,m.bucket,f.admin,preview.runId);assert.equal(verified.verified,2);assert.equal(verified.storedSourceContacts,2);assert.equal(verified.complete,true);
});
test('Contact migration snapshots before writes, preserves complete records, restricts DNC, and reruns idempotently',async()=>{
 const f=fixture(),m=migrationFixture();await assert.rejects(prepareContactMigration(f.db,m.bucket,f.a,m.manifest));
 const preview=await prepareContactMigration(f.db,m.bucket,f.admin,m.manifest);assert.equal(preview.summary.sourceContacts,3);assert.equal(preview.summary.ownerMemberships,1);assert.equal(preview.summary.orphanOwnerContacts,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,0);assert.ok([...m.objects.keys()].some(k=>k.endsWith('/backup.json')));
 const committed=await commitContactMigration(f.db,m.bucket,f.admin,preview.runId,0);assert.equal(committed.complete,true);await commitContactMigration(f.db,m.bucket,f.admin,preview.runId,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,3);
 const contacts=(await loadSnapshot(f.db,f.a)).contacts;assert.equal(contacts[0].rawFields.legacy_record_json,JSON.stringify(m.manifest.driver_profiles.find(r=>'legacy:'+r.id===contacts[0].id)));assert.equal(contacts.find(c=>c.id==='legacy:legacy-dnc')!.status,'do_not_contact');assert.equal(contacts.find(c=>c.id==='legacy:legacy-closed')!.status,'closed');await assert.rejects(workflowMutation(f.db,f.a,'claimContact',['legacy:legacy-dnc',{requestId:'migration-dnc-test'}]));
 assert.equal((await verifyContactMigration(f.db,m.bucket,f.admin,preview.runId)).verified,3);
 const again=await prepareContactMigration(f.db,m.bucket,f.admin,m.manifest);assert.equal(again.summary.expectedImports,0);assert.equal(again.summary.matched,3);
});
test('Contact mapping preserves orphan registry numbers, ambiguous phones, unresolved ownership and inactive stubs',()=>{
 const m=migrationFixture().manifest;m.owner_operator_contacts.push({phone_e164:'+12025550109',source_row:9,created_at:100000});m.driver_profiles.push({...m.driver_profiles[0],id:'ambiguous-two',phone_e164:'2025550101',assigned_email:'different@fixture.invalid'});
 const stubs=prepareRecruiterStubs(m,[]);assert.ok(stubs.every(r=>r.active===0));const mapped=mapLegacyContacts(m,stubs);assert.equal(mapped.orphanOwnerContacts,1);assert.equal(mapped.items.length,5);assert.equal(mapped.items.find(r=>r.sourceKey==='ambiguous-two')!.contact.ownerRecruiterId,null);assert.ok(mapped.items.filter(r=>r.contact.phoneNormalized==='+12025550101').every(r=>r.duplicate===1&&r.contact.status==='closed'));assert.equal(mapped.items.find(r=>r.sourceKey==='owner:+12025550109')!.contact.firstName,null);
});
test('Migration leaves newer destination facts intact and quarantines shared restricted phone collisions',async()=>{
 const f=fixture(),m=migrationFixture(),existing=await newDriver(f,f.a,'+12025550102');const preview=await prepareContactMigration(f.db,m.bucket,f.admin,m.manifest);assert.equal(preview.summary.duplicates,1);await commitContactMigration(f.db,m.bucket,f.admin,preview.runId,0);const row=f.sql.prepare('SELECT blocked,data_json FROM drivers WHERE id=?').get(existing)!;assert.equal(row.blocked,1);assert.equal(JSON.parse(String(row.data_json)).firstName,'Fictional');assert.equal(JSON.parse(String(row.data_json)).status,'do_not_contact');assert.equal((await verifyContactMigration(f.db,m.bucket,f.admin,preview.runId)).complete,true);
});
test('Start confirmation requires actual date/evidence; rejected expected revenue is zero while cash persists',async()=>{const f=await applicationFixture();await assert.rejects(operation(f.db,f.a,'set_stage',{applicationId:f.appId,stage:'start_confirmed',evidence:'Test actual start'}));await assert.rejects(operation(f.db,f.admin,'set_stage',{applicationId:f.appId,stage:'start_confirmed',evidence:'Test actual start'}));await operation(f.db,f.admin,'set_contract',{applicationId:f.appId,evidence:'Synthetic agreement',contract:{feeCents:200000,source:'Fixture agreement',milestones:[{id:'first',basisPoints:5000,trigger:'first_load',description:'After evidenced first load'},{id:'two-weeks',basisPoints:5000,trigger:'two_weeks',description:'After two verified weeks'}],commission:null}});await operation(f.db,f.admin,'add_transaction',{applicationId:f.appId,evidence:'Synthetic receipt',kind:'receipt',amountCents:100000,transactionId:'fixture-payment'});await operation(f.db,f.admin,'set_stage',{applicationId:f.appId,stage:'rejected',evidence:'Synthetic carrier rejection'});const app=(await overview(f.db,f.admin)).applications[0];assert.equal(app.summary.expectedFeeCents,0);assert.equal(app.summary.cashResultCents,100000);assert.equal(financialSummary('withdrawn',null,[{kind:'receipt',amount_cents:10000},{kind:'refund',amount_cents:2000},{kind:'cost',amount_cents:1000}]).cashResultCents,7000);});
test('Quo signature authenticates raw bytes, rejects stale/tampered payloads, deduplicates and reviews shared numbers',async()=>{const f=fixture(),id=await newDriver(f),secret='whsec_'+btoa('fixture-secret'),now=Date.now(),timestamp=String(Math.floor(now/1000));const body={id:'event-1',type:'call.completed',createdAt:new Date(now).toISOString(),data:{resource:{id:'call-1',duration:45},context:{userId:'quo-a',phoneNumberType:'private',participants:{external:['+12025550191'],resolution:'available'}}}};const raw=JSON.stringify(body),key=await crypto.subtle.importKey('raw',new TextEncoder().encode('fixture-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('delivery-1.'+timestamp+'.'+raw)));const signature=btoa(String.fromCharCode(...bytes)),headers=new Headers({'webhook-id':'delivery-1','webhook-timestamp':timestamp,'webhook-signature':'v1,'+signature});assert.equal(await verifyQuo(raw,headers,secret,now),'delivery-1');await assert.rejects(verifyQuo(raw+' ',headers,secret,now));await assert.rejects(verifyQuo(raw,headers,secret,now+400000));f.sql.prepare('INSERT INTO quo_mappings VALUES(?,?,?,?)').run('quo-a',f.a.id,now,f.admin.id);assert.equal((await ingestQuo(f.db,'delivery-1',body)).needsReview,false);assert.equal((await ingestQuo(f.db,'delivery-1',body)).duplicate,true);assert.equal(f.sql.prepare('SELECT driver_id FROM quo_events WHERE id=?').get('event-1')!.driver_id,id);await ingestQuo(f.db,'delivery-old',{...body,id:'event-old',createdAt:new Date(now-10000).toISOString(),type:'call.ringing'});assert.equal(f.sql.prepare('SELECT status FROM quo_events WHERE id=?').get('event-old')!.status,'historical');await ingestQuo(f.db,'delivery-shared',{...body,id:'event-shared',data:{...body.data,context:{...body.data.context,phoneNumberType:'shared'}}});assert.equal(f.sql.prepare('SELECT status FROM quo_events WHERE id=?').get('event-shared')!.status,'needs_review');});

test('Simultaneous assignment requests have one CAS winner and the losing retry assigns disjoint contacts',async()=>{const f=fixture();for(let i=0;i<20;i++){const d={...seed().contacts[0],id:'race-'+i,phoneNormalized:'+1202555'+String(i).padStart(4,'0'),ownerRecruiterId:null,isDemo:false};f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,next_action,data_json) VALUES(?,NULL,?,\'Review\',?)').run(d.id,d.phoneNormalized,JSON.stringify(d));}const input={count:10,reason:'Isolated concurrent test'};const requests=[{...input,recruiterId:f.a.id,requestId:'race-request-a'},{...input,recruiterId:f.b.id,requestId:'race-request-b'}];const results=await Promise.allSettled(requests.map(p=>operation(f.db,f.admin,'assign_batch',p)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const loser=results.findIndex(r=>r.status==='rejected');await operation(f.db,f.admin,'assign_batch',requests[loser]);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers WHERE owner_id=?').get(f.a.id)!.n,10);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers WHERE owner_id=?').get(f.b.id)!.n,10);});
test('Task reminders require ownership and closure evidence; receipts remain separate and survive reload',async()=>{const f=fixture(),{id,c}=await live(f);await assert.rejects(operation(f.db,f.b,'save_task',{driverId:id,kind:'callback',dueAt:new Date(Date.now()+3600000).toISOString(),nextAction:'Agreed callback',requestId:'test-task'}));await operation(f.db,f.a,'save_task',{driverId:id,kind:'callback',dueAt:new Date(Date.now()+3600000).toISOString(),nextAction:'Agreed callback',requestId:'test-task'});await assert.rejects(operation(f.db,f.a,'close_task',{taskId:'task:test-task',reason:''}));await operation(f.db,f.a,'close_task',{taskId:'task:test-task',reason:'Driver canceled callback'});await assert.rejects(operation(f.db,f.a,'confirm_receipt',{conversationId:c.id,externalId:'receipt-fixture',source:'Fixture application feed',evidence:'Synthetic receipt',receivedAt:new Date().toISOString()}));await operation(f.db,f.admin,'confirm_receipt',{conversationId:c.id,externalId:'receipt-fixture',source:'Fixture application feed',evidence:'Synthetic receipt',receivedAt:new Date().toISOString()});assert.equal((await loadSnapshot(f.db,f.a)).conversations[0].playbook?.externalReceipt?.id,'receipt-fixture');await workflowMutation(f.db,f.a,'saveCallNotes',[c.id,{nextAction:'Follow up after verified receipt'},{requestId:'receipt-note-fixture'}]);assert.equal((await loadSnapshot(f.db,f.a)).conversations[0].playbook?.externalReceipt?.id,'receipt-fixture');});
test('Former owner cannot replay a previously successful workflow receipt after reassignment',async()=>{const f=fixture(),id=await newDriver(f),meta={requestId:'old-owner-claim'};const c=ok(await workflowMutation(f.db,f.a,'claimContact',[id,meta])) as Conversation;ok(await workflowMutation(f.db,f.a,'cancelBeforeAttempt',[c.id,{requestId:'old-owner-cancel'}]));await operation(f.db,f.admin,'reassign',{driverId:id,expectedOwner:f.a.id,nextOwner:f.b.id,reason:'Synthetic reassignment',requestId:'old-owner-reassign'});await assert.rejects(workflowMutation(f.db,f.a,'claimContact',[id,meta]));});

test('Company urgent flag is admin-only, persists for every offer and clears without approving terms',async()=>{
 const f=fixture(),base={...seed().offers[0],companyName:'Urgent test carrier',isDemo:false,active:false,approvalStatus:'pending_review' as const,source:'approved_snapshot' as const};
 f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').run('urgent-carrier',base.companyName,'pending_review',1,'{}');
 for(const id of ['urgent-offer-1','urgent-offer-2'])f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(id,'urgent-carrier','1',JSON.stringify({...base,id}));
 await assert.rejects(operation(f.db,f.a,'set_company_urgent',{companyId:'urgent-carrier',urgent:true}));
 await operation(f.db,f.admin,'set_company_urgent',{companyId:'urgent-carrier',urgent:true});
 let offers=(await loadSnapshot(f.db,f.a)).offers;assert.equal(offers.length,2);assert.ok(offers.every(o=>o.urgent===true&&o.active===false&&o.approvalStatus==='pending_review'));
 assert.equal(f.sql.prepare('SELECT version FROM companies WHERE id=?').get('urgent-carrier')!.version,1);
 await operation(f.db,f.admin,'set_company_urgent',{companyId:'urgent-carrier',urgent:false});
 offers=(await loadSnapshot(f.db,f.a)).offers;assert.ok(offers.every(o=>o.urgent===false));
 const catalog=(await overview(f.db,f.admin)).catalog!;assert.ok(catalog.every(c=>c.urgent===0));
});

test('Existing imported carrier uses audited criteria after refresh and rejects incompatible SAP selection on the server',async()=>{
 const f=fixture(),draft=ownerCatalog.find(x=>x.id==='nis-express')!.drafts.find(x=>x.documentedTerms?.program==='company')!;
 const {matchingCriteria,...old}=draft;
 f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').run('nis-express',old.companyName,'pending_review',1,JSON.stringify({sourceHash:ownerCatalogSource.sha256}));
 f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(old.id,'nis-express','1',JSON.stringify(old));
 const {c}=await live(f);
 ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'position','Company driver','',{requestId:'source-position'}]));
 ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'employmentType','1099','',{requestId:'source-employment'}]));
 ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'sap','completed','',{requestId:'source-sap'}]));
 const rejected=await workflowMutation(f.db,f.a,'selectOffer',[c.id,old.id,{requestId:'source-bad-selection'}]);assert.equal(rejected.ok,false);
 const loaded=await loadSnapshot(f.db,f.a);assert.deepEqual(loaded.offers[0].matchingCriteria,matchingCriteria);assert.equal(loaded.conversations.find(x=>x.id===c.id)!.selectedOfferId,null);
 // Deriving source criteria does not rewrite carrier edits, availability, data
 // or terms IDs, and does not emit any application/notification.
 assert.equal(f.sql.prepare('SELECT data_json FROM offers WHERE id=?').get(old.id)!.data_json,JSON.stringify(old));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 const admin={...f.b,role:'admin' as const};await operation(f.db,admin,'set_company_urgent',{companyId:'nis-express',urgent:true});
 assert.equal((await loadSnapshot(f.db,f.a)).offers[0].urgent,true);
 await operation(f.db,f.admin,'set_company_urgent',{companyId:'nis-express',urgent:false});assert.equal((await loadSnapshot(f.db,f.a)).offers[0].urgent,false);
 f.sql.exec(readFileSync('drizzle/0002_team_referral_export.sql','utf8'));
 const catalog=(await overview(f.db,f.admin)).catalog!;assert.equal(JSON.parse(String(catalog[0].offer)).matchingCriteria.sap,'no_history');
});

test('Administrator release paginates imported review holds with backups, idempotency and preserved restrictions',async()=>{
 const f=fixture(),m=migrationFixture(),base=seed().contacts[0];
 for(let i=0;i<604;i++){
  const c={...base,id:'release-'+String(i).padStart(4,'0'),phoneRaw:'+1202555'+String(i).padStart(4,'0'),phoneNormalized:'+1202555'+String(i).padStart(4,'0'),status:i===600?'do_not_contact':i===601?'invalid_number':i===602?'callback_due':'closed',callbackAt:i===602?new Date(Date.now()+86400000).toISOString():null,ownerRecruiterId:f.a.id,reservedBy:null,activeConversationId:null,rawFields:{legacy_source_project:WORKBOOK_SOURCE,lead_status:'needs_review',note:'Preserved note',created_at:100000}};
  f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,?,?,?,?)').run(c.id,f.a.id,c.phoneNormalized,i===600?1:0,i===603?1:0,'Review',JSON.stringify(c));
 }
 const request={runId:crypto.randomUUID(),cursor:'',evidence:'Authorized administrator confirms imported drivers may be contacted.'};
 await assert.rejects(releaseImportedContacts(f.db,m.bucket,f.a,request));
 const first=await releaseImportedContacts(f.db,m.bucket,f.admin,request);assert.equal(first.released,500);assert.equal(first.complete,false);
 assert.deepEqual(await releaseImportedContacts(f.db,m.bucket,f.admin,request),first);
 const second=await releaseImportedContacts(f.db,m.bucket,f.admin,{...request,cursor:first.nextCursor});assert.equal(second.released,100);assert.equal(second.complete,true);
 assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM drivers WHERE json_extract(data_json,'$.status')='available'").get()!.n,600);
 const c=JSON.parse(String(f.sql.prepare("SELECT data_json FROM drivers WHERE id='release-0000'").get()!.data_json));
 assert.equal(c.ownerRecruiterId,f.a.id);assert.equal(c.rawFields.note,'Preserved note');assert.equal(c.rawFields.lead_status,'needs_review');assert.equal(c.rawFields.created_at,100000);assert.equal(c.rawFields.call_readiness_approved_by,f.admin.id);
 for(const i of [600,601,602,603])assert.notEqual(JSON.parse(String(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get('release-'+String(i).padStart(4,'0'))!.data_json)).status,'available');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM conversations').get()!.n,0);
 assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM audit WHERE type='imported_contacts_released'").get()!.n,2);
 assert.equal(m.objects.size,2);assert.equal(JSON.parse([...m.objects.values()][0]).before.length,500);
 const claim=ok(await workflowMutation(f.db,f.a,'claimContact',['release-0000',{requestId:'released-driver-opens-script'}])) as Conversation;
 assert.equal(claim.activeStepId,'opening');assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM audit WHERE json_extract(data_json,'$.type')='call_attempt_started'").get()!.n,0);
});

test('Authenticated real carrier import snapshots, stores every eligible carrier, excludes removed CHI, persists in workflow and reruns without duplicate or outbound writes',async()=>{
 const {importCarrierCatalog}=await import('../../src/server/carrier-catalog-import.ts');
 const {ownerCatalog}=await import('../../src/content/carrier-catalog/ownerCatalog.ts');
 const f=fixture(),m=migrationFixture();
 await assert.rejects(importCarrierCatalog(f.db,m.bucket,f.a,{syntheticSource:true}));
 const first=await importCarrierCatalog(f.db,m.bucket,f.admin,{syntheticSource:true});
 assert.equal(first.imported,30);assert.equal(first.failed,0);assert.equal(first.skipped,1);assert.equal(first.backupSaved,true);
 assert.equal(m.objects.size,2);const backup=JSON.parse([...m.objects.values()].find(v=>v.includes('"companies":'))!);assert.equal(backup.companies.length,0);
 const snapshot=await loadSnapshot(f.db,f.a);assert.equal(new Set(snapshot.offers.map(o=>o.companyName)).size,30);assert.equal(snapshot.offers.length,ownerCatalog.filter(c=>c.id!=='chi-logistics').flatMap(c=>c.drafts).length);
 assert.equal((await loadSnapshot(f.db,f.a)).offers.length,snapshot.offers.length);
 const replay=await importCarrierCatalog(f.db,m.bucket,f.admin,{syntheticSource:true});assert.equal(replay.imported,0);assert.equal(replay.matched,30);assert.equal(m.objects.size,2);
 for(const table of ['applications','tasks','linked_messages'])assert.equal(f.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n,0);
 f.sql.prepare("UPDATE companies SET data_json='{}',version=2 WHERE id='bbcl'").run();
 const conflict=await importCarrierCatalog(f.db,m.bucket,f.admin,{syntheticSource:true});assert.equal(conflict.skipped,2);assert.equal(conflict.matched,29);assert.equal(f.sql.prepare("SELECT version FROM companies WHERE id='bbcl'").get()!.version,2);
});

test('Imported programs allow one provisional choice, use program-specific closing terms and never become a confirmed application',async()=>{
 const {importCarrierCatalog}=await import('../../src/server/carrier-catalog-import.ts');
 const {companyTalkTrack}=await import('../../src/content/playbook/engine.ts');
 const {matchConversationOffer}=await import('../../src/domain/offerMatching.ts');
 const f=fixture(),m=migrationFixture();await importCarrierCatalog(f.db,m.bucket,f.admin,{syntheticSource:true});const {c}=await live(f);
 ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'position','Company driver','',{requestId:'catalog-position'}]));
 ok(await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'employmentType','1099','',{requestId:'catalog-employment'}]));
 ok(await workflowMutation(f.db,f.a,'conversationAction',[c.id,'application_next',{requestId:'catalog-next'}]));
 assert.equal((await workflowMutation(f.db,f.a,'conversationAction',[c.id,'agree_to_apply',{requestId:'catalog-no-company'}])).ok,false);
 const offers=(await loadSnapshot(f.db,f.a)).offers,first=offers.find(o=>o.id==='owner-yankee-freight-company')!,second=offers.find(o=>o.id==='owner-nis-express-company')!;
 let selected=ok(await workflowMutation(f.db,f.a,'selectOffer',[c.id,first.id,{requestId:'catalog-first'}])) as Conversation;
 assert.equal(matchConversationOffer(first,selected).state,'needs_confirmation');assert.match(companyTalkTrack(first,selected)!,/65–75 CPM/);assert.doesNotMatch(companyTalkTrack(first,selected)!,/88%/);
 selected=ok(await workflowMutation(f.db,f.a,'selectOffer',[c.id,second.id,{requestId:'catalog-second'}])) as Conversation;
 const speech=companyTalkTrack(second,selected)!;assert.match(speech,/70–75 CPM/);assert.match(speech,/confirm the current opening and terms/);assert.match(speech,/Want me to check this one for you/);assert.doesNotMatch(speech,/YANKEE|\[[^\]]+\]/);
 assert.equal((await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!.selectedOfferId,second.id);
 ok(await workflowMutation(f.db,f.a,'conversationAction',[c.id,'application_next',{requestId:'catalog-next-selected'}]));
 ok(await workflowMutation(f.db,f.a,'conversationAction',[c.id,'agree_to_apply',{requestId:'catalog-agree'}]));
 await assert.rejects(operation(f.db,f.a,'finalize_internal',{conversationId:c.id,offerVersion:second.snapshotVersion,requestId:'catalog-unverified'}));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
});

test('Reviewing one catalog program preserves source provenance, urgency and sibling program terms',async()…4053 tokens truncated…ricalNotes(f.db,f.a,p),changed);const refreshed=await conversationHistory(f.db,f.admin,c.id);assert.equal(refreshed.conversation.playbook!.notes.nextAction,p.notes.nextAction);for(const key of ['status','outcome','closedAt','answers','recruiterId','selectedOfferId'])assert.deepEqual(refreshed.conversation[key as keyof Conversation],conversation[key as keyof Conversation]);assert.deepEqual(f.sql.prepare('SELECT * FROM drivers WHERE id=?').get(id),driver);assert.deepEqual(f.sql.prepare('SELECT * FROM tasks').all(),tasks);assert.deepEqual(f.sql.prepare('SELECT payload_json FROM completion_notifications').get(),payload);assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM audit WHERE type='historical_notes_edited'").get()!.n,1);const byAdmin=await editHistoricalNotes(f.db,f.admin,{...p,notes:{...p.notes,owner:'Owner review'},expectedRevision:refreshed.conversation.revision,requestId:'admin-history-edit'});assert.equal(byAdmin.editedBy,f.admin.email);await assert.rejects(editHistoricalNotes(f.db,f.a,{...p,requestId:'stale-history-edit'}));});
test('Active notes, field edits, opening and navigation-related pauses never create summary records',async()=>{const f=fixture(),{c}=await live(f);ok(await workflowMutation(f.db,f.a,'saveCallNotes',[c.id,{nextAction:'Active draft'},{requestId:'ordinary-note-edit'}]));ok(await workflowMutation(f.db,f.a,'pause',[c.id,{requestId:'ordinary-pause'}]));await loadSnapshot(f.db,f.a);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);});
test('Email failures keep completed calls, require explicit success and reconcile uncertain delivery without resending',async()=>{const {deliverCompletion}=await import('../../src/server/completion-notifications.ts');const settings={url:'https://script.google.com/macros/s/fixture/exec',secret:'synthetic'};const f=fixture(),{c}=await live(f);ok(await workflowMutation(f.db,f.a,'finish',[c.id,'interested',null,{requestId:'email-finish'}]));let sends=0,status='failed',bodies:any[]=[];const send=(async(_u:any,o:any)=>{const p=JSON.parse(o.body);bodies.push(p);if(p.action==='conversationCompletionCapabilities')return Response.json({ok:true,conversationCompletion:{version:1}});if(p.action==='completeConversation'){sends++;return status==='200-only'?Response.json({ok:true}):Response.json({ok:status==='sent',notificationId:p.notificationId,email:{ok:status==='sent',status,safeToRetry:status==='failed'}});}return Response.json({ok:status==='sent',notificationId:p.notificationId,email:{ok:status==='sent',status}});}) as typeof fetch;assert.equal((await deliverCompletion(f.db,f.a,c.id,settings,'retry',send))!.status,'failed');assert.equal((await loadSnapshot(f.db,f.a)).conversations[0].status,'closed');status='200-only';assert.equal((await deliverCompletion(f.db,f.a,c.id,settings,'retry',send))!.status,'unconfirmed');const count=sends;status='sent';assert.equal((await deliverCompletion(f.db,f.a,c.id,settings,'retry',send))!.status,'sent');assert.equal(sends,count);assert.equal((await deliverCompletion(f.db,f.a,c.id,settings,'retry',send))!.status,'sent');assert.equal(sends,count);assert.equal(bodies.filter(p=>p.action==='completeConversation')[0].notificationId,bodies.filter(p=>p.action==='completeConversation')[1].notificationId);await assert.rejects(deliverCompletion(f.db,f.b,c.id,settings,'retry',send));});
test('Concurrent delivery calls acquire only one lease; refresh checks and lost acknowledgements cannot double-send',async()=>{const {deliverCompletion}=await import('../../src/server/completion-notifications.ts');const f=fixture(),{c}=await live(f);ok(await workflowMutation(f.db,f.a,'finish',[c.id,'interested',null,{requestId:'lease-finish'}]));let sends=0;const send=(async(_u:any,o:any)=>{const p=JSON.parse(o.body);if(p.action==='conversationCompletionCapabilities')return Response.json({ok:true,conversationCompletion:{version:1}});sends++;throw new Error('Acknowledgement lost');}) as typeof fetch;const config={url:'https://script.google.com/macros/s/fixture/exec',secret:'synthetic'};await Promise.all([deliverCompletion(f.db,f.a,c.id,config,'retry',send),deliverCompletion(f.db,f.a,c.id,config,'retry',send)]);assert.equal(sends,1);assert.equal(f.sql.prepare('SELECT status FROM completion_notifications').get()!.status,'unconfirmed');const actions:string[]=[];const reconcile=(async(_u:any,o:any)=>{const p=JSON.parse(o.body);actions.push(p.action);return Response.json(p.action==='conversationCompletionCapabilities'?{ok:true,conversationCompletion:{version:1}}:{ok:true,notificationId:p.notificationId,email:{ok:false,status:'not_found',safeToRetry:true}});}) as typeof fetch;assert.equal((await deliverCompletion(f.db,f.a,c.id,config,'retry',reconcile))!.status,'failed');assert.equal(actions.includes('completeConversation'),false);});
test('Unsupported legacy completion integration is blocked without calling an application or send action',async()=>{const {deliverCompletion}=await import('../../src/server/completion-notifications.ts');const f=fixture(),{c}=await live(f);ok(await workflowMutation(f.db,f.a,'finish',[c.id,'not_interested',null,{requestId:'blocked-finish'}]));const actions:string[]=[];const send=(async(_u:any,o:any)=>{actions.push(JSON.parse(o.body).action);return Response.json({ok:false,error:'Unsupported action.'});}) as typeof fetch;assert.equal((await deliverCompletion(f.db,f.a,c.id,{url:'https://script.google.com/macros/s/fixture/exec',secret:'synthetic'},'retry',send))!.status,'blocked');assert.deepEqual(actions,['conversationCompletionCapabilities']);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);});
test('Historical notes can be edited on Do Not Contact without removing restrictions or resending',async()=>{const {conversationHistory,editHistoricalNotes}=await import('../../src/server/historical-notes.ts');const f=fixture(),{id,c}=await live(f);ok(await workflowMutation(f.db,f.a,'finish',[c.id,'do_not_contact',null,{requestId:'finish-dnc-history'}]));const data=await conversationHistory(f.db,f.a,c.id),driver=f.sql.prepare('SELECT * FROM drivers WHERE id=?').get(id),notification=f.sql.prepare('SELECT * FROM completion_notifications').get();await editHistoricalNotes(f.db,f.a,{conversationId:c.id,notes:{...data.conversation.playbook!.notes,contactPreferences:'Do not contact remains in effect'},expectedRevision:data.conversation.revision,requestId:'edit-dnc-history'});assert.deepEqual(f.sql.prepare('SELECT * FROM drivers WHERE id=?').get(id),driver);assert.equal(driver!.blocked,1);assert.deepEqual(f.sql.prepare('SELECT * FROM completion_notifications').get(),notification);assert.equal((await conversationHistory(f.db,f.a,c.id)).lastEdit.verifiedEmail,f.a.email);});
test('Expired send lease is reconciled only, and pending company does not block a general Finish summary',async()=>{const {deliverCompletion}=await import('../../src/server/completion-notifications.ts');const f=fixture(),{c}=await live(f);const offer={...seed().offers[3],id:'pending-selected',approvalStatus:'pending_review',recruitingApproved:false};f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').run('pending-company',offer.companyName,'pending_review',1,'{}');f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(offer.id,'pending-company','fixture',JSON.stringify(offer));const current=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;current.selectedOfferId=offer.id;f.sql.prepare('UPDATE conversations SET data_json=? WHERE id=?').run(JSON.stringify(current),c.id);ok(await workflowMutation(f.db,f.a,'finish',[c.id,'interested',null,{requestId:'finish-pending-choice'}]));const payload=JSON.parse(String(f.sql.prepare('SELECT payload_json FROM completion_notifications').get()!.payload_json));assert.equal(payload.selectedCompany.approvalStatus,'pending_review');assert.equal(payload.selectedCompany.recruitingApproved,false);f.sql.prepare("UPDATE completion_notifications SET status='sending',lease_token='lost-process',lease_at=1").run();const actions:string[]=[];const send=(async(_u:any,o:any)=>{const p=JSON.parse(o.body);actions.push(p.action);return Response.json(p.action==='conversationCompletionCapabilities'?{ok:true,conversationCompletion:{version:1}}:{ok:true,notificationId:p.notificationId,email:{ok:true,status:'sent'}});}) as typeof fetch;assert.equal((await deliverCompletion(f.db,f.a,c.id,{url:'https://script.google.com/macros/s/fixture/exec',secret:'synthetic'},'retry',send))!.status,'sent');assert.deepEqual(actions,['conversationCompletionCapabilities','conversationCompletionStatus']);});

test('Admin assignment preview excludes restrictions, callbacks, history and active work; commit is exact and idempotent',async()=>{
 const {previewAssignment,commitAssignment,adminOverview}=await import('../../src/server/admin.ts');const f=fixture();
 for(let i=0;i<8;i++){const d={...seed().contacts[0],id:'admin-preview-'+i,phoneNormalized:'+1202555040'+i,phoneRaw:'+1202555040'+i,ownerRecruiterId:null,isDemo:false,status:i===2?'callback_due':i===3?'closed':'available',activeConversationId:null};f.sql.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,NULL,?,?,?,\'Review\',?)').run(d.id,d.phoneNormalized,i===0?1:0,i===1?1:0,JSON.stringify(d));}
 f.sql.prepare("UPDATE drivers SET data_json=json_set(data_json,'$.isDemo',json('true')) WHERE id='admin-preview-4'").run();
 f.sql.prepare("UPDATE drivers SET data_json=json_set(data_json,'$.activeConversationId','another-call') WHERE id='admin-preview-5'").run();
 const input={recruiterId:f.a.id,count:500,reason:'Approved synthetic batch',requestId:'preview-exact'};
 await assert.rejects(previewAssignment(f.db,f.a,input),/Administrator/);
 const preview=await previewAssignment(f.db,f.admin,input);assert.deepEqual(preview.contactIds,['admin-preview-6','admin-preview-7']);assert.equal(preview.available,2);
 const commit={...input,contactIds:preview.contactIds};assert.equal((await commitAssignment(f.db,f.admin,commit)).assigned,2);assert.equal((await commitAssignment(f.db,f.admin,commit)).assigned,2);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers WHERE owner_id=?').get(f.a.id)!.n,2);
 assert.equal((await loadSnapshot(f.db,f.a)).contacts.length,2);
 await assert.rejects(commitAssignment(f.db,f.admin,{...commit,recruiterId:f.b.id}),/request changed/);
 const data=await adminOverview(f.db,f.admin);assert.equal(data.eligible,0);assert.equal(data.activity.length,0);assert.equal(data.roster.find(r=>r.id===f.a.id)!.assigned,2);const activity=await adminOverview(f.db,f.admin,0,'Activity');assert.equal(activity.activity[0].type,'contacts_assigned');await assert.rejects(adminOverview(f.db,f.b),/Administrator/);
});
test('A changed assignment preview rolls back every contact and audit rather than substituting other contacts',async()=>{
 const {previewAssignment,commitAssignment}=await import('../../src/server/admin.ts');const f=fixture();const id=await newDriver(f);f.sql.prepare("UPDATE drivers SET owner_id=NULL,data_json=json_set(data_json,'$.ownerRecruiterId',NULL) WHERE id=?").run(id);
 const p={recruiterId:f.a.id,count:1,reason:'Synthetic preview',requestId:'changed-preview'},preview=await previewAssignment(f.db,f.admin,p);assert.equal(preview.available,1);
 f.sql.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact') WHERE id=?").run(id);
 await assert.rejects(commitAssignment(f.db,f.admin,{...p,contactIds:preview.contactIds}),/Records changed/);assert.equal(f.sql.prepare('SELECT owner_id FROM drivers WHERE id=?').get(id)!.owner_id,null);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM audit WHERE id=?').get('admin-assignment:changed-preview')!.n,0);
});
test('Admins can manage Admin and Senior recruiter access; Owner role and account remain owner-controlled',async()=>{
 const f=fixture(),admin={...f.b,role:'admin' as const};const p={id:'new-approved-account',userId:null,email:'approved-new@fixture.invalid',name:'Real Name',alias:'Call Alias',role:'recruiter',active:true,referralUrl:null,callbackNumber:'+12025550180',timeZone:'America/Chicago'};
 await operation(f.db,admin,'save_recruiter',p);const actor=await resolveActor(f.db,{userId:'verified-new-user',email:'APPROVED-NEW@fixture.invalid'});assert.equal(actor.profile.fullName,'Real Name');assert.equal(actor.profile.alias,'Call Alias');assert.equal(actor.userId,'verified-new-user');
 f.sql.prepare("UPDATE recruiters SET data_json=json_set(data_json,'$.faqFacts',json(?)) WHERE id=?").run(JSON.stringify({fact:{value:'verified',source:'owner',verifiedAt:'2026-10-01T00:00:00Z',expiresAt:'2027-10-01T00:00:00Z'}}),p.id);
 await operation(f.db,admin,'save_recruiter',{...p,alias:'Updated Alias',isSenior:true});assert.equal((await resolveActor(f.db,{userId:'verified-new-user',email:p.email})).profile.faqFacts!.fact.value,'verified');assert.equal((await resolveActor(f.db,{userId:'verified-new-user',email:p.email})).profile.isSenior,true);
 await assert.rejects(operation(f.db,admin,'save_recruiter',{...p,role:'admin',isSenior:true}),/Only recruiter accounts/);
 await operation(f.db,admin,'save_recruiter',{...p,role:'admin'});assert.equal((await resolveActor(f.db,{userId:'verified-new-user',email:p.email})).role,'admin');
 await operation(f.db,admin,'save_recruiter',{...p,role:'recruiter',isSenior:true});assert.equal((await resolveActor(f.db,{userId:'verified-new-user',email:p.email})).profile.isSenior,true);
 await assert.rejects(operation(f.db,admin,'save_recruiter',{...p,role:'owner',isSenior:false}),/Only an owner can assign/);
 const changed=await operation(f.db,admin,'save_recruiter',{...p,email:'replacement@fixture.invalid'}) as {saved:boolean;emailRelinkRequired:boolean};assert.equal(changed.emailRelinkRequired,true);assert.equal(f.sql.prepare('SELECT user_id FROM recruiters WHERE id=?').get(p.id)!.user_id,null);await assert.rejects(resolveActor(f.db,{userId:'verified-new-user',email:p.email}));
 const relinked=await resolveActor(f.db,{userId:'verified-new-user-2',email:'replacement@fixture.invalid'});assert.equal(relinked.id,p.id);assert.equal(relinked.profile.fullName,p.name);
 await assert.rejects(operation(f.db,admin,'save_recruiter',{...p,id:'duplicate-account',email:'replacement@fixture.invalid'}),/already has an account/);
 await operation(f.db,f.admin,'save_recruiter',{...p,email:'replacement@fixture.invalid',role:'admin'});assert.equal((await resolveActor(f.db,{userId:'verified-new-user-2',email:'replacement@fixture.invalid'})).role,'admin');
 await operation(f.db,f.admin,'save_recruiter',{...p,email:'replacement@fixture.invalid',active:false});await assert.rejects(resolveActor(f.db,{userId:'verified-new-user-2',email:'replacement@fixture.invalid'}));
});
test('Company field editing preserves conditional rules, versions and urgent flag, clears selections and keeps unverified edits unapproved',async()=>{
 const {saveCompanyFields}=await import('../../src/server/admin.ts');const f=fixture(),o=ownerCatalog.flatMap(record=>record.drafts).find(o=>o.matchingCriteria)!;const companyId='edited-company';
 f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').run(companyId,o.companyName,'pending_review',1,JSON.stringify({sourceHash:ownerCatalogSource.sha256,urgent:true}));f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(o.id,companyId,'1',JSON.stringify(o));
 const {c}=await live(f);f.sql.prepare("UPDATE conversations SET data_json=json_set(data_json,'$.selectedOfferId',?) WHERE id=?").run(o.id,c.id);
 const p={companyId,offerId:o.id,expectedVersion:1,name:o.companyName,status:'pending_review',source:'Written terms reviewed in synthetic test',employment:o.employment,requiredLicense:o.requiredLicense,hiringStates:o.hiringStates,matchingCriteria:o.matchingCriteria!,summary:o.documentedTerms!.summary,schedule:o.documentedTerms!.schedule,equipment:o.documentedTerms!.equipment,deductions:o.documentedTerms!.deductions,payUnit:o.pay.unit,payMin:o.pay.min,payMax:o.pay.max,payBasis:o.pay.basis,reviewed:false};
 await assert.rejects(saveCompanyFields(f.db,f.a,p),/Administrator/);await saveCompanyFields(f.db,f.admin,p);
 const loaded=await loadSnapshot(f.db,f.a),saved=loaded.offers.find(x=>x.id===o.id)!;assert.equal(saved.recruitingApproved,false);assert.equal(saved.approvalStatus,'pending_review');assert.equal(saved.urgent,true);assert.deepEqual(saved.matchingCriteria!.stateMinimumOutDays,o.matchingCriteria!.stateMinimumOutDays);assert.equal(loaded.conversations.find(x=>x.id===c.id)!.selectedOfferId,null);
 await assert.rejects(saveCompanyFields(f.db,f.admin,p),/Catalog changed/);
 await saveCompanyFields(f.db,f.admin,{...p,expectedVersion:2,status:'active',reviewed:true});assert.equal((await loadSnapshot(f.db,f.a)).offers.find(x=>x.id===o.id)!.recruitingApproved,true);
});

test('Admins create documented companies with unknown facts retained; duplicate names and deleted companies cannot be recreated',async()=>{
 const {saveCompanyFields,adminOverview}=await import('../../src/server/admin.ts');const f=fixture();const criteria={source:'Signed synthetic offer',sap:'unknown',trailers:[],excludedTrailers:[],trucks:[],routes:[],excludedStates:[],excludedCities:[],minimumOutDays:null,stateMinimumOutDays:{},minimumExperienceMonths:null,trailerExperienceMonths:{},review:['Current opening needs verification']};const p={companyId:'synthetic-new-company',offerId:'synthetic-new-offer',expectedVersion:0,create:true,program:'company',name:'Synthetic New Carrier',status:'pending_review',source:criteria.source,employment:'unknown',requiredLicense:null,hiringStates:null,matchingCriteria:criteria,summary:'Pay requires verification.',schedule:'Schedule requires verification.',equipment:'Equipment requires verification.',deductions:[],payUnit:'unknown',payMin:null,payMax:null,payBasis:'unknown',reviewed:false};
 await assert.rejects(saveCompanyFields(f.db,f.a,p),/Administrator/);await saveCompanyFields(f.db,f.admin,p);const saved=(await loadSnapshot(f.db,f.a)).offers.find(o=>o.id===p.offerId)!;assert.equal(saved.pay.min,null);assert.equal(saved.requiredLicense,null);assert.equal(saved.recruitingApproved,false);assert.equal(saved.documentedTerms!.program,'company');assert.equal((await adminOverview(f.db,f.admin)).catalog.length,1);
 await assert.rejects(saveCompanyFields(f.db,f.admin,p),/already created/);await assert.rejects(saveCompanyFields(f.db,f.admin,{...p,companyId:'different-id',offerId:'different-offer',name:' synthetic new carrier '}),/already exists/);
 const {removeCompany}=await import('../../src/server/company-removal.ts');await removeCompany(f.db,f.admin,{companyId:p.companyId,expectedVersion:1,reason:'Test removal'});assert.equal((await adminOverview(f.db,f.admin)).catalog.length,0);assert.equal((await loadSnapshot(f.db,f.a)).offers.length,0);await assert.rejects(saveCompanyFields(f.db,f.admin,{...p,create:false,expectedVersion:2}),/removed/);
});
test('Company deletion is permission-checked and versioned, preserves historical applications, and clears all active program selections',async()=>{
 const {removeCompany}=await import('../../src/server/company-removal.ts');const f=fixture(),offer={...seed().offers[0],isDemo:false,source:'approved_snapshot',approvalStatus:'approved',recruitingApproved:true},companyId='synthetic-removal-company';
 f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,1,?)').run(companyId,offer.companyName,'active',JSON.stringify({urgent:true}));f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(offer.id,companyId,'1',JSON.stringify(offer));const {c,id}=await live(f);f.sql.prepare("UPDATE conversations SET data_json=json_set(data_json,'$.selectedOfferId',?,'$.playbook.flow.applicationIntent','agreed') WHERE id=?").run(offer.id,c.id);
 f.sql.prepare("INSERT INTO applications(id,driver_id,conversation_id,offer_id,terms_version,stage,data_json) VALUES('historic-app',?,?,?,'1','internally_finalized',?)").run(id,c.id,offer.id,JSON.stringify({terms:offer,notes:'Historical evidence'}));const before=f.sql.prepare('SELECT * FROM applications').all();const input={companyId,expectedVersion:1,reason:'Owner requested removal'};
 await assert.rejects(removeCompany(f.db,f.a,input),/Administrator/);await assert.rejects(removeCompany(f.db,f.admin,{...input,expectedVersion:9}),/Company changed/);await removeCompany(f.db,f.admin,input);await removeCompany(f.db,f.admin,input);
 assert.deepEqual(f.sql.prepare('SELECT * FROM applications').all(),before);const company=f.sql.prepare('SELECT * FROM companies WHERE id=?').get(companyId)!;assert.equal(company.status,'inactive');assert.ok(JSON.parse(String(company.data_json)).deletedAt);assert.equal((await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!.selectedOfferId,null);assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM audit WHERE type='company_removed'").get()!.n,1);await assert.rejects(operation(f.db,f.admin,'set_company_urgent',{companyId,urgent:true}),/unavailable/);
});
test('Requested CHI Logistics removal suppresses offers immediately and is durably applied once at authenticated admin access',async()=>{
 const {applyRequestedCompanyRemovals}=await import('../../src/server/company-removal.ts');const f=fixture(),offer=ownerCatalog.find(r=>r.id==='chi-logistics')!.drafts[0];f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,1,?)').run('chi-logistics','CHI LOGISTICS','pending_review',JSON.stringify({sourceHash:ownerCatalogSource.sha256}));f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(offer.id,'chi-logistics','1',JSON.stringify(offer));assert.equal((await loadSnapshot(f.db,f.a)).offers.length,0);
 await applyRequestedCompanyRemovals(f.db,f.a);assert.equal(f.sql.prepare("SELECT status FROM companies WHERE id='chi-logistics'").get()!.status,'pending_review');await applyRequestedCompanyRemovals(f.db,f.admin);await applyRequestedCompanyRemovals(f.db,f.admin);assert.equal(f.sql.prepare("SELECT status FROM companies WHERE id='chi-logistics'").get()!.status,'inactive');assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM audit WHERE type='company_removed'").get()!.n,1);
});


test('Ten extra demo drivers belong only to verified Alex email, persist, and never reset on rerun',async()=>{
 const f=fixture(),alex={...f.a,email:'cvetanovicaleksa45@gmail.com'};
 f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(alex.email,alex.id);
 assert.deepEqual(await applyRequestedAlexDemoContacts(f.db,f.b),{created:0});
 assert.deepEqual(await applyRequestedAlexDemoContacts(f.db,{...f.b,email:alex.email}),{created:0});
 assert.deepEqual(await applyRequestedAlexDemoContacts(f.db,alex),{created:10});
 const contacts=(await loadSnapshot(f.db,alex)).contacts;
 assert.equal(contacts.length,10);assert.ok(contacts.every(c=>c.isDemo&&c.ownerRecruiterId===alex.id&&c.firstName?.startsWith('Demo ')&&c.status==='available'));
 assert.equal(new Set(contacts.map(c=>c.phoneNormalized)).size,10);
 f.sql.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact') WHERE id=?").run(contacts[0].id);
 assert.deepEqual(await applyRequestedAlexDemoContacts(f.db,alex),{created:0});
 const after=(await loadSnapshot(f.db,alex)).contacts;assert.equal(after.length,10);assert.equal(after.find(c=>c.id===contacts[0].id)!.status,'do_not_contact');
 assert.equal((await loadSnapshot(f.db,f.b)).contacts.length,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});


test('Recruiter adds a contact directly, sees it after reload, and repeat phone does not duplicate or reset it',async()=>{
 const f=fixture(),input={name:'New Fictional Driver',phone:'202-555-0191',email:'',nextAction:'Call about company positions'};
 const added=await operation(f.db,f.a,'create_driver',input) as {id:string;message:string};
 assert.match(added.message,/No administrator approval/);
 const contact=(await loadSnapshot(f.db,f.a)).contacts.find(c=>c.id===added.id)!;
 assert.equal(contact.status,'available');assert.equal(contact.ownerRecruiterId,f.a.id);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM assignment_requests').get()!.n,0);
 const repeat=await operation(f.db,f.a,'create_driver',{...input,phone:'+12025550191',name:'Other name'}) as {id:string};assert.equal(repeat.id,added.id);
 assert.equal((await loadSnapshot(f.db,f.a)).contacts.length,1);assert.equal((await loadSnapshot(f.db,f.b)).contacts.length,0);
 const c=ok(await workflowMutation(f.db,f.a,'claimContact',[added.id,{requestId:'direct-contact-claim'}])) as Conversation;assert.equal(c.contactId,added.id);
});

test('Adding eligible unassigned phone assigns directly; protected or another recruiter records stay unchanged',async()=>{
 const f=fixture(),id=await newDriver(f),input={name:'Ignored replacement',phone:'+12025550191',email:'',nextAction:'Call'};
 await assert.rejects(operation(f.db,f.b,'create_driver',input),/already assigned/);
 f.sql.prepare("UPDATE drivers SET owner_id=NULL,data_json=json_set(data_json,'$.ownerRecruiterId',NULL) WHERE id=?").run(id);
 const assigned=await operation(f.db,f.b,'create_driver',input) as {id:string};assert.equal(assigned.id,id);
 const contact=(await loadSnapshot(f.db,f.b)).contacts[0];assert.equal(contact.firstName,'Fictional');assert.equal(contact.status,'available');assert.equal(contact.ownerRecruiterId,f.b.id);
 f.sql.prepare("UPDATE drivers SET owner_id=NULL,blocked=1,data_json=json_set(data_json,'$.ownerRecruiterId',NULL,'$.status','do_not_contact') WHERE id=?").run(id);
 await assert.rejects(operation(f.db,f.a,'create_driver',input),/restriction/);
 assert.equal(f.sql.prepare('SELECT owner_id FROM drivers WHERE id=?').get(id)!.owner_id,null);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,1);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});


test('Owner supplied referrals map by verified email and persist without changing profiles, assignments or later edits',async()=>{
 const f=fixture();
 for(const [i,link] of ownerReferralLinks.filter(x=>x.email).entries()){
  const profile={...f.a.profile,id:'ref-'+i,alias:link.names[0],referralUrl:null};
  f.sql.prepare('INSERT INTO recruiters(id,email,role,active,data_json) VALUES(?,?,?,1,?)').run(profile.id,link.email,'recruiter',JSON.stringify(profile));
 }
 const result=await applyOwnerReferrals(f.db,f.admin);assert.equal(result.updated,16);assert.deepEqual(result.unresolved,['ivona','natalie','adriana','bojan','dawson']);
 for(const link of ownerReferralLinks.filter(x=>x.email)){
  const row=f.sql.prepare('SELECT data_json FROM recruiters WHERE email=?').get(link.email)!;
  const profile=JSON.parse(String(row.data_json));assert.equal(profile.referralUrl,link.url);assert.equal(profile.alias,link.names[0]);
 }
 f.sql.prepare("UPDATE recruiters SET data_json=json_set(data_json,'$.referralUrl',?) WHERE email=?").run('https://apply.ttirecruiting.us/?ref=later-approved','azzinjo86@gmail.com');
 assert.equal((await applyOwnerReferrals(f.db,f.admin)).updated,0);
 assert.equal(JSON.parse(String(f.sql.prepare('SELECT data_json FROM recruiters WHERE email=?').get('azzinjo86@gmail.com')!.data_json)).referralUrl,'https://apply.ttirecruiting.us/?ref=later-approved');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
});

test('Referral name matching accepts only exact unique supplied identities; recruiter updates only self and snapshot immediately uses own link',async()=>{
 const f=fixture(),alex={...f.a,email:'cvetanovicaleksa45@gmail.com'};f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(alex.email,alex.id);
 const mike={...f.b,email:'belopoljacmihailo@gmail.com'};f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(mike.email,mike.id);
 assert.equal((await applyOwnerReferrals(f.db,alex)).updated,1);assert.equal(alex.profile.referralUrl,'https://apply.ttirecruiting.us/?ref=alex');assert.equal((await loadSnapshot(f.db,alex)).recruiter.referralUrl,alex.profile.referralUrl);
 assert.equal(JSON.parse(String(f.sql.prepare('SELECT data_json FROM recruiters WHERE id=?').get(mike.id)!.data_json)).referralUrl,null);
 const record=(id:string,name:string)=>({id,email:id+'@fixture.invalid',data_json:JSON.stringify({...f.a.profile,alias:name,fullName:''})});
 assert.equal(matchOwnerReferrals([record('one','Ivona')]).find(x=>x.link.key==='ivona')!.account!.id,'one');
 assert.equal(matchOwnerReferrals([record('one','Ivona'),record('two','Ivona')]).find(x=>x.link.key==='ivona')!.account,null);
 assert.equal(matchOwnerReferrals([record('one','Dawson Other')]).find(x=>x.link.key==='dawson')!.account,null);
 assert.equal(matchOwnerReferrals([record('one','Nash')]).find(x=>x.link.key==='nash')!.account,null);
});

test('Version 3 migrates retired B04 from the real database snapshot and persists the practical step on save',async()=>{const f=fixture(),{c}=await live(f);await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'position','Company driver','',{requestId:'v3-db-pos'}]);await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'employmentType','1099','',{requestId:'v3-db-path'}]);await workflowMutation(f.db,f.a,'saveGuideAnswer',[c.id,'priority','Home time','',{requestId:'v3-db-priority'}]);f.sql.prepare("UPDATE conversations SET data_json=json_set(data_json,'$.activeStepId','B04','$.playbook.flow.interrupted',json('{\"stage\":\"qualification\",\"stepId\":\"guide_dealbreakers\"}')) WHERE id=?").run(c.id);let saved=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;assert.equal(saved.activeStepId,'guide_state');assert.equal(saved.playbook?.flow?.interrupted?.stepId,'guide_state');assert.equal(saved.playbook?.guide?.answers.priority,'Home time');await workflowMutation(f.db,f.a,'pause',[c.id,{requestId:'v3-db-pause'}]);saved=(await loadSnapshot(f.db,f.a)).conversations.find(x=>x.id===c.id)!;assert.equal(saved.activeStepId,'guide_state');assert.equal(JSON.parse(String(f.sql.prepare('SELECT data_json FROM conversations WHERE id=?').get(c.id)!.data_json)).activeStepId,'guide_state');assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);});

test('Requested demo removal snapshots only Alex fictional contacts, cancels active practice without notifications, preserves real contacts and restrictions, and survives refresh',async()=>{const f=fixture(),alex={...f.a,email:'cvetanovicaleksa45@gmail.com'};f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(alex.email,alex.id);await fixturePracticeDrivers(f);await applyRequestedAlexDemoContacts(f.db,alex);const real=await newDriver(f);const beforeReal=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json;const beforeOther=f.sql.prepare("SELECT data_json FROM drivers WHERE owner_id='b' ORDER BY id").all();const demo=(await loadSnapshot(f.db,alex)).contacts.find(c=>c.isDemo)!;const conversation=ok(await workflowMutation(f.db,alex,'claimContact',[demo.id,{requestId:'cleanup-claim'}])) as Conversation;const restricted=(await loadSnapshot(f.db,alex)).contacts.find(c=>c.isDemo&&c.id!==demo.id)!;f.sql.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact') WHERE id=?").run(restricted.id);assert.deepEqual(await applyRequestedDemoRemoval(f.db),{removed:15,remaining:0});assert.deepEqual(await applyRequestedDemoRemoval(f.db),{removed:15,remaining:0});assert.deepEqual(await applyRequestedAlexDemoContacts(f.db,alex),{created:0});const refreshed=await loadSnapshot(f.db,alex);assert.deepEqual(assignedContactView(refreshed,'assigned').map(c=>c.id),[real]);assert.equal(nextAvailableContact(refreshed,'none')?.id,real);assert.equal(refreshed.conversations.find(c=>c.id===conversation.id)!.status,'cancelled');assert.equal(refreshed.contacts.find(c=>c.id===restricted.id)!.status,'do_not_contact');assert.equal(f.sql.prepare('SELECT blocked FROM drivers WHERE id=?').get(restricted.id)!.blocked,1);assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json,beforeReal);assert.deepEqual(f.sql.prepare("SELECT data_json FROM drivers WHERE owner_id='b' ORDER BY id").all(),beforeOther);assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM audit WHERE type='demo_contact_archived'").get()!.n,15);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);const rejected=await workflowMutation(f.db,alex,'claimContact',[demo.id,{requestId:'cleanup-reclaim'}]);assert.equal(rejected.ok,false);});

test('All-account demo removal covers every recruiter and unassigned demo, preserves real data and prevents demo reseeding',async()=>{const f=fixture(),alex={...f.a,email:'cvetanovicaleksa45@gmail.com'};f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(alex.email,alex.id);await fixturePracticeDrivers(f);await applyRequestedAlexDemoContacts(f.db,alex);const real=await newDriver(f);const beforeReal=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json;const practice=(await loadSnapshot(f.db,f.b)).contacts[0];f.sql.prepare("UPDATE drivers SET owner_id=NULL,data_json=json_set(data_json,'$.ownerRecruiterId',NULL) WHERE id=?").run(practice.id);await applyRequestedDemoRemoval(f.db);assert.deepEqual(await applyRequestedAllDemoRemoval(f.db),{removed:10,remaining:0});assert.deepEqual(await applyRequestedAllDemoRemoval(f.db),{removed:10,remaining:0});for(const actor of [alex,f.b,f.admin]){const snapshot=await loadSnapshot(f.db,actor);assert.equal(assignedContactView(snapshot,'assigned').some(c=>c.isDemo),false);assert.equal(nextAvailableContact(snapshot,'none')?.isDemo??false,false);}assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM drivers WHERE json_extract(data_json,'$.isDemo')=1 AND json_extract(data_json,'$.rawFields.demoRemovedAt') IS NULL").get()!.n,0);assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json,beforeReal);await assert.rejects(operation(f.db,f.admin,'seed_demo_contacts',{requestId:'blocked-reseed'}),/seeding is disabled/);assert.deepEqual(await applyRequestedAlexDemoContacts(f.db,alex),{created:0});assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);});

test('New laptop practice request creates exactly ten fresh Alex-only contacts after global cleanup and never resets or duplicates them',async()=>{const f=fixture(),alex={...f.a,email:'cvetanovicaleksa45@gmail.com'};f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(alex.email,alex.id);await fixturePracticeDrivers(f);await applyRequestedAlexDemoContacts(f.db,alex);await applyRequestedAllDemoRemoval(f.db);const real=await newDriver(f),beforeReal=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json;assert.deepEqual(await applyRequestedLaptopDemoContacts(f.db),{created:10,total:10});assert.deepEqual(await applyRequestedAllDemoRemoval(f.db),{removed:25,remaining:0});const available=assignedContactView(await loadSnapshot(f.db,alex),'available').filter(c=>c.isDemo);assert.equal(available.length,10);assert.equal(new Set(available.map(c=>c.phoneNormalized)).size,10);assert.ok(available.every(c=>c.ownerRecruiterId===alex.id&&c.firstName?.startsWith('Demo ')&&c.lastName&&c.rawFields.demo_batch==='alex-laptop-ten-20261005'));for(const other of [f.b,f.admin])assert.equal(assignedContactView(await loadSnapshot(f.db,other),'assigned').some(c=>c.isDemo),false);f.sql.prepare("UPDATE drivers SET blocked=1,data_json=json_set(data_json,'$.status','do_not_contact') WHERE id=?").run(available[0].id);assert.deepEqual(await applyRequestedLaptopDemoContacts(f.db),{created:10,total:10});assert.equal(assignedContactView(await loadSnapshot(f.db,alex),'available').filter(c=>c.isDemo).length,9);assert.equal(f.sql.prepare('SELECT blocked FROM drivers WHERE id=?').get(available[0].id)!.blocked,1);assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json,beforeReal);assert.equal(f.sql.prepare("SELECT COUNT(*) AS n FROM drivers WHERE json_extract(data_json,'$.rawFields.demoRemovedAt') IS NOT NULL").get()!.n,25);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);});
test('Laptop practice does not create or guess an account if verified Alex email is missing',async()=>{const f=fixture();assert.deepEqual(await applyRequestedLaptopDemoContacts(f.db),{created:0,total:0});assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,0);});

test('Evening Alex cleanup archives only own demo contacts and prevents laptop reseeding',async()=>{
 const f=fixture(),alex={...f.a,email:'cvetanovicaleksa45@gmail.com'};
 f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run(alex.email,alex.id);
 await fixturePracticeDrivers(f);
 await applyRequestedAllDemoRemoval(f.db);
 await applyRequestedLaptopDemoContacts(f.db);
 const real=await newDriver(f),before=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json;
 const demos=(await loadSnapshot(f.db,alex)).contacts.filter(c=>c.isDemo&&!c.rawFields.demoRemovedAt);
 f.sql.prepare("UPDATE drivers SET owner_id=?,data_json=json_set(data_json,'$.ownerRecruiterId',?) WHERE id=?").run(f.b.id,f.b.id,demos[0].id);
 const otherBefore=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(demos[0].id)!.data_json;
 assert.deepEqual(await applyRequestedAlexLaptopDemoRemoval(f.db),{removed:9,remaining:0});
 assert.deepEqual(await applyRequestedAlexLaptopDemoRemoval(f.db),{removed:9,remaining:0});
 assert.deepEqual(await applyRequestedLaptopDemoContacts(f.db),{created:0,total:0});
 assert.equal(assignedContactView(await loadSnapshot(f.db,alex),'assigned').some(c=>c.isDemo),false);
 assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(real)!.data_json,before);
 assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(demos[0].id)!.data_json,otherBefore);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('Admin name search covers the whole database, paginates, escapes wildcards and never changes contacts',async()=>{
 const {searchAdminContacts}=await import('../../src/server/admin.ts');
 const f=fixture(),baseId=await newDriver(f),base=JSON.parse(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(baseId)!.data_json as string);
 const insert=f.sql.prepare("INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,?,0,'Synthetic search test',?)");
 for(let i=0;i<1030;i++){
  const target=i>1000,c={...base,id:'search-'+i,firstName:target?'Morgan':'Other',lastName:target?"O'Neil":'Filler',ownerRecruiterId:f.b.id,status:i===1029?'do_not_contact':'available',rawFields:i===1001?{demoRemovedAt:Date.now()}:{}},phone='+1312555'+String(2000+i);
  insert.run(c.id,f.b.id,phone,i===1029?1:0,JSON.stringify(c));
 }
 const revision=await currentRevision(f.db),before=f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n;
 await assert.rejects(searchAdminContacts(f.db,f.a,{query:'Morgan',page:0}),/Administrator access required/);
 const first=await searchAdminContacts(f.db,f.admin,{query:"  MORGAN   o'ne  ",page:0});
 assert.equal(first.total,28);assert.equal(first.contacts.length,25);assert.ok(first.contacts.every(c=>c.name==="Morgan O'Neil"&&c.recruiter==='b'));
 const second=await searchAdminContacts(f.db,{...f.admin,role:'admin'},{query:'neil',page:1});
 assert.equal(second.contacts.length,3);assert.equal(new Set([...first.contacts,...second.contacts].map(c=>c.id)).size,28);
 assert.ok([...first.contacts,...second.contacts].some(c=>c.status==='do_not_contact'));
 assert.equal((await searchAdminContacts(f.db,f.admin,{query:'%',page:0})).total,0);
 assert.equal((await searchAdminContacts(f.db,f.admin,{query:'_',page:0})).total,0);
 assert.equal((await searchAdminContacts(f.db,f.admin,{query:'',page:0})).total,0);
 await assert.rejects(searchAdminContacts(f.db,f.admin,{query:'Morgan',page:-1}));
 assert.equal(await currentRevision(f.db),revision);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,before);
});

test('Adding a contact needs only a valid phone, supports admin assignment and preserves duplicate protections',async()=>{
 const f=fixture();
 const saved=await operation(f.db,f.a,'create_driver',{phone:'(312) 555-0123'}) as {id:string};
 const contact=(await loadSnapshot(f.db,f.a)).contacts.find(c=>c.id===saved.id)!;
 assert.equal(contact.firstName,null);assert.equal(contact.lastName,null);assert.equal(contact.phoneNormalized,'+13125550123');assert.equal(contact.status,'available');assert.equal(contact.ownerRecruiterId,f.a.id);
 assert.ok(assignedContactView(await loadSnapshot(f.db,f.a),'available').some(c=>c.id===saved.id));
 assert.equal((await operation(f.db,f.a,'create_driver',{phone:'+13125550123',nextAction:'  '} ) as {id:string}).id,saved.id);
 await assert.rejects(operation(f.db,f.b,'create_driver',{phone:'+13125550123'}),/already assigned/);
 await assert.rejects(operation(f.db,f.a,'create_driver',{phone:'3125550124',ownerId:f.b.id}),/Administrator access required/);
 const assigned=await operation(f.db,f.admin,'create_driver',{phone:'3125550124',name:'  Chris   Jones  ',email:' chris@example.invalid ',ownerId:f.b.id}) as {id:string};
 const driver=(await loadSnapshot(f.db,f.b)).contacts.find(c=>c.id===assigned.id)!;
 assert.equal(driver.firstName,'Chris');assert.equal(driver.lastName,'Jones');assert.equal(driver.email,'chris@example.invalid');assert.equal(driver.status,'available');
 await assert.rejects(operation(f.db,f.a,'create_driver',{phone:'invalid'}),/valid phone/);
 await assert.rejects(operation(f.db,f.a,'create_driver',{phone:'3125550125',email:'invalid'}));
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,2);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM assignment_requests').get()!.n,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('Adding an imported unassigned phone fills missing identity, preserves provenance and makes it first after refresh',async()=>{
 const {searchAdminContacts}=await import('../../src/server/admin.ts');
 const f=fixture(),older=await newDriver(f,f.b,'+12025550192'),id=await newDriver(f,f.a);
 const original=(await dossier(f.db,f.a,id)).contact;
 original.firstName=null;original.lastName=null;original.nameEvidence='unknown';original.sourceRecordId='owner-workbook:stable-source';original.rawFields.legacy_record_json='original source';
 f.sql.prepare('UPDATE drivers SET owner_id=NULL,data_json=? WHERE id=?').run(JSON.stringify({...original,ownerRecruiterId:null}),id);
 const added=await operation(f.db,f.b,'create_driver',{phone:'2025550191',name:'Taylor Morgan',email:'taylor@example.invalid'}) as {id:string;contact:{name:string;ownerId:string;canOpen:boolean}};
 assert.equal(added.id,id);assert.equal(added.contact.name,'Taylor Morgan');assert.equal(added.contact.ownerId,f.b.id);assert.equal(added.contact.canOpen,true);
 // Ensure a deterministic earlier time for the other contact's original add event.
 f.sql.prepare('UPDATE audit SET at=1 WHERE driver_id=?').run(older);
 const snapshot=await loadSnapshot(f.db,f.b);assert.equal(snapshot.contacts[0].id,id);
 assert.equal(snapshot.contacts[0].email,'taylor@example.invalid');assert.equal(snapshot.contacts[0].sourceRecordId,original.sourceRecordId);assert.equal(snapshot.contacts[0].rawFields.legacy_record_json,'original source');
 assert.equal((await searchAdminContacts(f.db,f.admin,{query:'Taylor Morgan',page:0})).contacts[0].id,id);
 assert.equal((await searchAdminContacts(f.db,f.admin,{query:'(202) 555-0191',page:0})).contacts[0].id,id);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,2);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('Retry of an assigned nameless contact saves missing identity but conflicting names are explicitly preserved',async()=>{
 const f=fixture(),added=await operation(f.db,f.a,'create_driver',{phone:'2025550191'}) as {id:string};
 const result=await operation(f.db,f.a,'create_driver',{phone:'+12025550191',name:'Taylor Morgan'}) as {id:string;contact:{name:string};idempotent:boolean};
 assert.equal(result.id,added.id);assert.equal(result.idempotent,true);assert.equal(result.contact.name,'Taylor Morgan');
 const conflict=await operation(f.db,f.a,'create_driver',{phone:'+12025550191',name:'Another Person'}) as {message:string;contact:{name:string}};
 assert.equal(conflict.contact.name,'Taylor Morgan');assert.match(conflict.message,/recorded name was preserved/);
 assert.equal((await loadSnapshot(f.db,f.a)).contacts[0].lastName,'Morgan');assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,1);
});

test('Explicit Jordan name correction updates only the exact authorized contact, snapshots prior identity and does not reset restrictions',async()=>{
 const {applyRequestedContactNameCorrection,contactNameCorrectionMarker}=await import('../../src/server/requested-contact-name-correction.ts');
 const f=fixture();f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run('cvetanovicaleksa45@gmail.com',f.a.id);
 const id='legacy:workbook-phone-e6a3c21750f143e6847b912c';
 const created=await newDriver(f,f.a,'+16107186412'),before=(await dossier(f.db,f.a,created)).contact;
 const c={...before,id,firstName:'Marshall',lastName:'Existing',status:'do_not_contact',rawFields:{...before.rawFields,legacy_record_json:'preserved source'}};
 f.sql.prepare('UPDATE drivers SET id=?,blocked=1,data_json=? WHERE id=?').run(id,JSON.stringify(c),created);
 const other=await newDriver(f,f.a,'+12025550192'),otherBefore=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(other)!.data_json;
 assert.deepEqual(await applyRequestedContactNameCorrection(f.db),{verified:true,applied:true});
 const saved=f.sql.prepare('SELECT * FROM drivers WHERE id=?').get(id)!;const d=JSON.parse(saved.data_json as string);
 assert.equal(d.firstName,'Jordan');assert.equal(d.lastName,'Christman');assert.equal(d.status,'do_not_contact');assert.equal(saved.blocked,1);assert.equal(saved.owner_id,f.a.id);assert.equal(d.rawFields.legacy_record_json,'preserved source');
 const audit=JSON.parse(f.sql.prepare('SELECT data_json FROM audit WHERE id=?').get(contactNameCorrectionMarker)!.data_json as string);assert.equal(JSON.parse(audit.beforeDriver.data_json).firstName,'Marshall');
 assert.deepEqual(await applyRequestedContactNameCorrection(f.db),{verified:true,applied:false});
 assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(other)!.data_json,otherBefore);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('Jordan correction cannot change another owner or create a missing contact',async()=>{
 const {applyRequestedContactNameCorrection}=await import('../../src/server/requested-contact-name-correction.ts');const f=fixture();
 assert.deepEqual(await applyRequestedContactNameCorrection(f.db),{verified:false,applied:false});
 const created=await newDriver(f,f.b,'+16107186412'),id='legacy:workbook-phone-e6a3c21750f143e6847b912c';const before=f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(created)!.data_json;
 f.sql.prepare('UPDATE drivers SET id=? WHERE id=?').run(id,created);
 assert.deepEqual(await applyRequestedContactNameCorrection(f.db),{verified:false,applied:false});assert.equal(f.sql.prepare('SELECT data_json FROM drivers WHERE id=?').get(id)!.data_json,before);
});

test('Verified missing Quo lines are added exactly once without changing existing names, assignments or contact allocations',async()=>{
 const {applyRequestedQuoLineAdditions,requestedQuoLines}=await import('../../src/server/requested-quo-line-additions.ts');const f=fixture();f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run('cvetanovicaleksa45@gmail.com',f.admin.id);
 f.sql.prepare('INSERT INTO quo_line_profiles(id,display_name,phone,recruiter_id,created_at,updated_at) VALUES(?,?,?,?,1,1)').run('PNexisting','Recorded line name','+12025550111',f.a.id);
 const before=f.sql.prepare('SELECT * FROM quo_line_profiles WHERE id=?').get('PNexisting');
 await applyRequestedQuoLineAdditions(f.db);await applyRequestedQuoLineAdditions(f.db);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM quo_line_profiles').get()!.n,6);
 for(const line of requestedQuoLines){const row=f.sql.prepare('SELECT * FROM quo_line_profiles WHERE id=?').get(line.id)!;assert.equal(row.display_name,line.name);assert.equal(row.phone,line.number);assert.equal(row.recruiter_id,null);}
 assert.deepEqual(f.sql.prepare('SELECT * FROM quo_line_profiles WHERE id=?').get('PNexisting'),before);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM quo_line_allocations').get()!.n,0);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM recruiters').get()!.n,3);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});
test('Missing Quo line additions reject phone conflicts atomically',async()=>{
 const {applyRequestedQuoLineAdditions,requestedQuoLines}=await import('../../src/server/requested-quo-line-additions.ts');const f=fixture();f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run('cvetanovicaleksa45@gmail.com',f.admin.id);
 f.sql.prepare('INSERT INTO quo_line_profiles(id,display_name,phone,created_at,updated_at) VALUES(?,?,?,1,1)').run('PNexisting','Existing',requestedQuoLines[4].number);
 await assert.rejects(applyRequestedQuoLineAdditions(f.db),/another profile/);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM quo_line_profiles').get()!.n,1);
});

test('Uros contact names recover verified same-phone source and evidence without guessing or changing ownership',async()=>{
 const {applyRequestedUrosContactNames,recoverRecordedContactName}=await import('../../src/server/requested-uros-contact-names.ts');const f=fixture();f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run('urosmladenovice25@gmail.com',f.a.id);
 const id=await newDriver(f),unknown=await operation(f.db,f.a,'create_driver',{phone:'+12025550192'}) as {id:string};
 const c=(await dossier(f.db,f.a,id)).contact;c.firstName=null;c.lastName=null;c.nameEvidence='unknown';c.rawFields.legacy_record_json=JSON.stringify({phone_e164:c.phoneNormalized,first_name:'Taylor',last_name:'Morgan'});
 assert.equal(recoverRecordedContactName(c),'Taylor Morgan');assert.equal(recoverRecordedContactName({...c,phoneNormalized:'+12025550193'}),null);
 f.sql.prepare('UPDATE drivers SET data_json=? WHERE id=?').run(JSON.stringify(c),id);
 const summary=await applyRequestedUrosContactNames(f.db);assert.deepEqual(summary,{total:2,missingBefore:2,repaired:1,remaining:1});assert.deepEqual(await applyRequestedUrosContactNames(f.db),summary);
 assert.equal((await dossier(f.db,f.a,id)).contact.firstName,'Taylor');assert.equal((await dossier(f.db,f.a,id)).contact.ownerRecruiterId,f.a.id);assert.equal((await dossier(f.db,f.a,unknown.id)).contact.firstName,null);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('Authorized Uros replacement exchanges only untouched nameless queue contacts for named unassigned records with a verified backup',async()=>{
 const {replaceRequestedUrosContacts}=await import('../../src/server/requested-uros-contact-replacement.ts');const f=fixture();f.sql.prepare('UPDATE recruiters SET email=? WHERE id=?').run('urosmladenovice25@gmail.com',f.a.id);
 const unknown=await operation(f.db,f.a,'create_driver',{phone:'+12025550191'}) as {id:string},protectedDriver=await operation(f.db,f.a,'create_driver',{phone:'+12025550192'}) as {id:string};
 const active=ok(await workflowMutation(f.db,f.a,'claimContact',[protectedDriver.id,{requestId:'protect-active-uros'}])) as Conversation;
 const named=await newDriver(f,f.b,'+12025550193');f.sql.prepare("UPDATE drivers SET owner_id=NULL,data_json=json_set(data_json,'$.ownerRecruiterId',NULL) WHERE id=?").run(named);
 const objects=new Map<string,string>(),bucket={async put(k:string,v:string){objects.set(k,v);},async head(k:string){return objects.has(k)?{}:null;}} as unknown as R2Bucket;
 const first=await replaceRequestedUrosContacts(f.db,bucket);assert.deepEqual(first,{replaced:1,protected:1,missing:1,status:'completed'});assert.deepEqual(await replaceRequestedUrosContacts(f.db,bucket),first);
 assert.equal(f.sql.prepare('SELECT owner_id FROM drivers WHERE id=?').get(unknown.id)!.owner_id,null);assert.equal(f.sql.prepare('SELECT owner_id FROM drivers WHERE id=?').get(named)!.owner_id,f.a.id);assert.equal(f.sql.prepare('SELECT owner_id FROM drivers WHERE id=?').get(protectedDriver.id)!.owner_id,f.a.id);assert.equal(f.sql.prepare('SELECT status FROM conversations WHERE id=?').get(active.id)!.status,'active');
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM drivers').get()!.n,3);assert.equal(objects.size,1);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM completion_notifications').get()!.n,0);
});

test('My contacts persist for self-created and historic self-added drivers, while admin assignments remain Assigned contacts',async()=>{
 const f=fixture(),self=await newDriver(f),assigned=await operation(f.db,f.admin,'create_driver',{phone:'+12025550192',name:'Assigned Driver',ownerId:f.a.id}) as {id:string};
 let snapshot=await loadSnapshot(f.db,f.a);assert.deepEqual(assignedContactView(snapshot,'mine').map(c=>c.id),[self]);assert.deepEqual(assignedContactView(snapshot,'assigned').map(c=>c.id),[assigned.id]);
 // Existing saves before this release are recovered from stable audit actor/owner IDs.
 f.sql.prepare("UPDATE drivers SET data_json=json_remove(data_json,'$.rawFields.myContactRecruiterId') WHERE id=?").run(self);
 snapshot=await loadSnapshot(f.db,f.a);assert.deepEqual(assignedContactView(snapshot,'mine').map(c=>c.id),[self]);
 assert.equal(assignedContactView(await loadSnapshot(f.db,f.b),'mine').length,0);
 const c=ok(await workflowMutation(f.db,f.a,'claimContact',[self,{requestId:'my-contact-script-open'}])) as Conversation;assert.equal(c.contactId,self);
 assert.equal((await loadSnapshot(f.db,f.a)).contacts.find(x=>x.id===self)!.rawFields.myContactRecruiterId,f.a.id);
});

test('Company Finder recommendation writes are denied to recruiter accounts server-side',async()=>{
 const f=fixture();
 await assert.rejects(operation(f.db,f.a,'save_finder_recommendation',{
  conversationId:'unavailable',offerId:'unavailable',requestId:'finder-role-test',
  filters:{position:'Company driver',employmentType:'1099',home:'7',trailer:'Dry van',experienceMonths:'12-24',sap:'no'}
 }),/Administrator access required/);
 await assert.rejects(operation(f.db,f.a,'save_finder_filters',{conversationId:'unavailable',requestId:'finder-filters-role-test',filters:{position:'',employmentType:'',home:'',trailer:'',experienceMonths:'',sap:''}}),/Administrator access required/);
 const {requireSeniorOrAdmin}=await import('../../src/server/access.ts');
 assert.throws(()=>requireSeniorOrAdmin(f.a),/Administrator access required/);
 assert.doesNotThrow(()=>requireSeniorOrAdmin({...f.a,profile:{...f.a.profile,isSenior:true}}));
});

test('Senior Company Finder selection validates against its filters and accepts W-2 offers',async()=>{
 const f=fixture(),{id,c}=await live(f),senior={...f.a,profile:{...f.a.profile,isSenior:true}};
 const seededConversation=JSON.parse(String(f.sql.prepare('SELECT data_json FROM conversations WHERE id=?').get(c.id)!.data_json)) as Conversation;
 seededConversation.playbook??={notes:{nonNegotiables:'',verifiedTermsDiscussed:'',unresolvedQuestion:'',contactPreferences:'',nextAction:'',owner:'',dueAt:null,dueTimeZone:'',channel:'unknown'},last1099StepId:null,applicationStatus:'unknown',communicationStatus:'not_prepared',communicationPermission:'unknown'};
 seededConversation.playbook.guide={answers:{position:'Company driver',employmentType:'1099',state:'IL',experienceMonths:'24',sap:'no',trailer:'Dry van',route:'Regional',home:'7'},confirmed:{position:true,employmentType:true,state:true,experienceMonths:true,sap:true,trailer:true,route:true,home:true},reviewReasons:{},lastAnswered:null};
 f.sql.prepare('UPDATE conversations SET data_json=? WHERE id=?').run(JSON.stringify(seededConversation),c.id);
 const offer:Offer={...seed().offers[1],id:'finder-w2-offer',companyName:'Finder W-2 Carrier',employment:'w2',isDemo:false,source:'approved_snapshot',active:true,approvalStatus:'approved',recruitingApproved:true,verifiedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z',snapshotVersion:'finder-test-v1',hiringStates:['IL'],requiredLicense:'A',minExperienceMonths:12,routeType:'regional',homeTime:'weekly',requirements:[{field:'position',kind:'hard',operator:'in',values:['Company driver'],label:'Position'},{field:'sap',kind:'hard',operator:'in',values:['no'],label:'SAP'},{field:'trailer',kind:'hard',operator:'in',values:['Dry van'],label:'Trailer'}]};
 f.sql.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,?,?)').run('finder-w2-company',offer.companyName,'active',1,'{}');
 f.sql.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,?,?)').run(offer.id,'finder-w2-company',offer.snapshotVersion,JSON.stringify(offer));
 const result=await operation(f.db,senior,'save_finder_recommendation',{conversationId:c.id,offerId:offer.id,requestId:'finder-w2-selection',filters:{position:'Company driver',employmentType:'W-2',home:'7',trailer:'Dry van',experienceMonths:'24+',sap:''}}) as {saved:boolean;revision:number};
 assert.equal(result.saved,true);const chosen=JSON.parse(String(f.sql.prepare('SELECT data_json FROM conversations WHERE id=?').get(c.id)!.data_json)) as Conversation;
 assert.equal(chosen.playbook?.finderRecommendation?.offerId,offer.id);assert.equal(chosen.playbook?.finderRecommendation?.filters.employmentType,'W-2');assert.deepEqual(chosen.playbook?.companyFinderFilters,chosen.playbook?.finderRecommendation?.filters);assert.equal(chosen.playbook?.finderRecommendation?.matchState,'needs_confirmation');assert.ok(chosen.playbook?.finderRecommendation?.missingFacts?.length);assert.equal(result.revision,chosen.revision);assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM applications').get()!.n,0);
 const filters={position:'Company driver',employmentType:'1099',home:'14',trailer:'Reefer',experienceMonths:'12-24',sap:'completed'};const savedFilters=await operation(f.db,senior,'save_finder_filters',{conversationId:c.id,requestId:'finder-filters-finish',filters}) as {saved:boolean;revision:number};assert.equal(savedFilters.saved,true);const latest=JSON.parse(String(f.sql.prepare('SELECT data_json FROM conversations WHERE id=?').get(c.id)!.data_json)) as Conversation;assert.deepEqual(latest.playbook?.companyFinderFilters,filters);assert.equal(latest.playbook?.finderRecommendation?.offerId,offer.id);assert.equal(latest.revision,savedFilters.revision);
});

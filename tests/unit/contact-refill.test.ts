import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

test('code-only schema migration preserves queues and restrictions without importing or assigning data',()=>{
 const db=new DatabaseSync(':memory:');
 for(const file of ['0000_familiar_nemesis','0001_flawless_frog_thor','0003_lively_prowler'])db.exec(readFileSync(`drizzle/${file}.sql`,'utf8'));
 db.prepare('INSERT INTO recruiters(id,email,role,active,data_json) VALUES(?,?,?,?,?)').run('bootstrap-aleksa','cvetanovicaleksa45@gmail.com','admin',1,'{}');
 db.exec(readFileSync('drizzle/0004_approved_account_roster.sql','utf8'));
 db.exec('INSERT INTO store_revision VALUES(1,0)');
 const add=(id:string,owner:string|null,status='available',blocked=0,extra:Record<string,unknown>={})=>{
  const data={id,firstName:'Fixture',lastName:'Driver',nameEvidence:'explicit_source',ownerRecruiterId:owner,status,phoneNormalized:`+1202${id.padStart(7,'0')}`,notes:'keep',rawFields:{source:'keep'},...extra};
  db.prepare('INSERT INTO drivers(id,owner_id,phone,blocked,duplicate,next_action,data_json) VALUES(?,?,?,?,0,?,?)').run(id,owner,data.phoneNormalized,blocked,'preserve next step',JSON.stringify(data));
 };
 for(let i=0;i<500;i++)add(String(i),'bootstrap-aleksa',i===0?'closed':'available');
 for(let i=500;i<4520;i++)add(String(i),null);
 add('5000',null,'do_not_contact',1);add('5001',null,'callback_due',0,{callbackAt:'2030-01-01'});
 add('5002',null,'available',0,{reservedBy:'someone',activeConversationId:'active'});
 add('5003',null,'available');
 db.exec("INSERT INTO quo_line_profiles(id,display_name,phone,created_at,updated_at) VALUES('PNfixture','Unresolved line','+12025550000',1,1)");
 db.exec("INSERT INTO quo_line_allocations(driver_id,line_id,batch_id,allocated_at) VALUES('5003','PNfixture','original',1)");
 const protectedBefore=db.prepare("SELECT * FROM drivers WHERE id IN ('0','5000','5001','5002','5003') ORDER BY id").all();
 const migration=readFileSync('drizzle/0006_recruiter_contact_refill.sql','utf8');db.exec(migration);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM recruiter_contact_refill').get()!.n,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM recruiter_contact_refill_backups').get()!.n,0);
 const after=db.prepare('SELECT * FROM drivers ORDER BY id').all();
 assert.deepEqual(db.prepare("SELECT * FROM drivers WHERE id IN ('0','5000','5001','5002','5003') ORDER BY id").all(),protectedBefore);
 db.exec(migration);assert.deepEqual(db.prepare('SELECT * FROM drivers ORDER BY id').all(),after);
 assert.equal(db.prepare('SELECT value FROM store_revision').get()!.value,0);
 db.close();
});

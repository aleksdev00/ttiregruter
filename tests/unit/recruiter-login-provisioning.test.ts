import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {provisionRecruiterLoginCore} from '../../src/server/recruiter-login-provisioning-core.ts';
import type {Actor} from '../../src/server/access.ts';

function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE recruiters(id TEXT PRIMARY KEY,email TEXT,role TEXT,active INTEGER,user_id TEXT,data_json TEXT);
 CREATE TABLE recruiter_login_bindings(recruiter_id TEXT PRIMARY KEY,auth_user_id TEXT UNIQUE,verified_email TEXT UNIQUE,must_change INTEGER,updated_at INTEGER);
 CREATE TABLE recruiter_login_attempts(attempt_key TEXT,attempted_at INTEGER);
 CREATE TABLE audit(id TEXT PRIMARY KEY,actor_id TEXT,type TEXT,at INTEGER,data_json TEXT);
 CREATE TABLE store_revision(id INTEGER PRIMARY KEY,value INTEGER); INSERT INTO store_revision VALUES(1,1);
 CREATE TABLE mutation_guards(id TEXT PRIMARY KEY,ok INTEGER);`);
 sql.prepare('INSERT INTO recruiters VALUES(?,?,?,?,?,?)').run('approved-test','recruiter@example.test','recruiter',1,null,JSON.stringify({fullName:'Test Recruiter',alias:'Test'}));
 function prepared(query:string,args:SQLInputValue[]=[]){return {bind(...values:SQLInputValue[]){return prepared(query,values);},async first<T>(){return (sql.prepare(query).get(...args) as T|undefined)??null;},async all<T>(){return {results:sql.prepare(query).all(...args) as T[],success:true};},async run(){return {success:true,meta:sql.prepare(query).run(...args)};}};}
 const db={prepare:prepared,async batch(statements:ReturnType<typeof prepared>[]){sql.exec('BEGIN');try{const values=[];for(const statement of statements)values.push(await statement.run());sql.exec('COMMIT');return values;}catch(error){sql.exec('ROLLBACK');throw error;}}} as unknown as D1Database;
 const users:Array<{id:string;email:string;email_confirmed_at:string|null}> = [];
 let createCalls=0,resetCalls=0,temporaryPassword='';
 const admin={async listUsers({page,perPage}:{page:number;perPage:number}){const start=(page-1)*perPage;return {data:{users:users.slice(start,start+perPage)},error:null};},async createUser(input:{email:string;password:string;email_confirm:true;user_metadata:Record<string,string>}){createCalls++;temporaryPassword=input.password;const user={id:'auth-test-uuid',email:input.email,email_confirmed_at:'2026-10-24T00:00:00Z'};users.push(user);return {data:{user},error:null};}};
 const deps={admin,async sendReset(){resetCalls++;return true;},now:()=>1234};
 const actor={id:'admin-1',userId:'auth-admin',email:'admin@example.test',role:'admin',profile:{id:'admin-1',fullName:'Admin',alias:'Admin',referralUrl:null,callbackNumber:null,contactEmail:'admin@example.test',reportingTimeZone:'UTC',isDemo:false}} as Actor;
 return {db,sql,users,deps,actor,get counts(){return {createCalls,resetCalls,temporaryPassword};}};
}

test('admin provisions an active recruiter login, links the exact approved email, and sends password setup',async()=>{
 const f=fixture();
 const result=await provisionRecruiterLoginCore(f.db,f.actor,{recruiterId:'approved-test'},'https://recruiter.ttirecruiting.us',f.deps);
 assert.equal(result.linked,true);assert.equal(result.emailAccepted,true);assert.equal(f.counts.createCalls,1);assert.equal(f.counts.resetCalls,1);
 assert.ok(f.counts.temporaryPassword.length>=32);assert.ok(!JSON.stringify(result).includes(f.counts.temporaryPassword));
 assert.deepEqual({...f.sql.prepare('SELECT recruiter_id,auth_user_id,verified_email,must_change FROM recruiter_login_bindings').get()},{recruiter_id:'approved-test',auth_user_id:'auth-test-uuid',verified_email:'recruiter@example.test',must_change:1});
 assert.equal(f.sql.prepare('SELECT user_id FROM recruiters WHERE id=?').get('approved-test')?.user_id,'auth-test-uuid');
});

test('re-running setup reuses the existing Auth identity and binding without creating a duplicate',async()=>{
 const f=fixture();
 await provisionRecruiterLoginCore(f.db,f.actor,{recruiterId:'approved-test'},'https://recruiter.ttirecruiting.us',f.deps);
 await provisionRecruiterLoginCore(f.db,f.actor,{recruiterId:'approved-test'},'https://recruiter.ttirecruiting.us',f.deps);
 assert.equal(f.counts.createCalls,1);assert.equal(f.counts.resetCalls,2);
});

test('setup refuses an unconfirmed Auth identity and never links it',async()=>{
 const f=fixture();f.users.push({id:'existing-auth',email:'recruiter@example.test',email_confirmed_at:null});
 await assert.rejects(provisionRecruiterLoginCore(f.db,f.actor,{recruiterId:'approved-test'},'https://recruiter.ttirecruiting.us',f.deps),/has not verified/);
 assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM recruiter_login_bindings').get()?.n,0);assert.equal(f.counts.resetCalls,0);
});

test('inactive accounts and non-admin actors cannot provision logins',async()=>{
 const f=fixture();f.sql.prepare('UPDATE recruiters SET active=0 WHERE id=?').run('approved-test');
 await assert.rejects(provisionRecruiterLoginCore(f.db,f.actor,{recruiterId:'approved-test'},'https://recruiter.ttirecruiting.us',f.deps),/active recruiter/);
 const recruiter={...f.actor,role:'recruiter'} as Actor;
 await assert.rejects(provisionRecruiterLoginCore(f.db,recruiter,{recruiterId:'approved-test'},'https://recruiter.ttirecruiting.us',f.deps),/Administrator access required/);
});

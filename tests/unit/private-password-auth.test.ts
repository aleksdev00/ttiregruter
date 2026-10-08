import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);

function fixture(){
 const source=readFileSync(new URL('../../src/server/private-auth.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const jar=new Map<string,string>(),mockRequire=(name:string)=>name==='next/headers'?{cookies:async()=>({get:(key:string)=>jar.has(key)?{value:jar.get(key)}:undefined,set:(key:string,value:string)=>jar.set(key,value)})}:name==='next/navigation'?{redirect:(path:string)=>{throw Error('redirect:'+path)}}:name==='cloudflare:workers'?{env:{}}:name==='./access'?{ServiceError:class ServiceError extends Error{status:number;code:string;constructor(message:string,status=400,code='invalid_input'){super(message);this.status=status;this.code=code;}}}:require(name);
 const module={exports:{} as Record<string,any>};new Function('require','module','exports',js)(mockRequire,module,module.exports);
 const sql=new DatabaseSync(':memory:'),db={prepare(query:string){let args:unknown[]=[];return {bind(...values:unknown[]){args=values;return this;},async first(){return sql.prepare(query).get(...args as never[])??null;},async all(){return {results:sql.prepare(query).all(...args as never[])};},async run(){const result=sql.prepare(query).run(...args as never[]);return {meta:{changes:Number(result.changes)}};}};},async exec(query:string){sql.exec(query);},async batch(statements:{run:()=>Promise<unknown>}[]){const out=[];for(const statement of statements)out.push(await statement.run());return out;}} as unknown as D1Database;
 return {auth:module.exports,db,sql,jar};
}
const settings={HQ_WEBHOOK_URL:'https://example.test/macros/s/private/exec',HQ_WEBHOOK_SECRET:'private-test-secret'};

test('three approved test accounts use their assigned initial passwords and must change them on first login',async()=>{
 const {auth,db,jar}=fixture();
 for(const [email,password] of [['cvetanovicaleksa45@gmail.com','aleksa.cvetanovic2026'],['lakikiller09@gmail.com','lazar.jevtic2026'],['mikicn956@gmail.com','nate.mitchell2026']]){
  const session=await auth.signIn(db,email,password);assert.equal(session.email,email);assert.equal(session.mustChangePassword,true);assert.ok(jar.has('tti_private_session'));
 }
 await assert.rejects(auth.signIn(db,'unapproved@example.com','someone2026'),/incorrect/i);
});

test('password changes are isolated by account and clear only that account forced-change flag',async()=>{
 const {auth,db,sql}=fixture(),email='lakikiller09@gmail.com';const session=await auth.signIn(db,email,'lazar.jevtic2026');
 await auth.changePrivatePassword(db,{userId:session.userId,email,displayName:'Lazar Jevtic',fullName:'Lazar Jevtic',mustChangePassword:true},undefined,'freshPrivatePass123');
 assert.equal(sql.prepare('SELECT must_change FROM private_login_state WHERE email=?').get(email)!.must_change,0);
 assert.equal(sql.prepare('SELECT must_change FROM private_login_state WHERE email=?').get('mikicn956@gmail.com')!.must_change,1);
 const signedIn=await auth.signIn(db,email,'freshPrivatePass123');assert.equal(signedIn.mustChangePassword,false);
});

test('forgot-password reset code is one-use and targets the requested approved account',async()=>{
 const {auth,db,sql}=fixture(),original=globalThis.fetch,email='mikicn956@gmail.com';let message:any;
 globalThis.fetch=(async(_url,init)=>{message=JSON.parse(String(init?.body));return Response.json({ok:true,email:{ok:true,status:'sent'}});}) as typeof fetch;
 try{
  assert.equal(await auth.requestPrivatePasswordReset(db,email,settings),true);assert.equal(message.emailType,'password_reset');assert.equal(message.recipient,email);assert.match(message.resetCode,/^\d{6}$/);
  await auth.resetPrivatePassword(db,email,message.resetCode,'freshPrivatePass123');assert.equal(sql.prepare('SELECT must_change FROM private_login_state WHERE email=?').get(email)!.must_change,0);
  const session=await auth.signIn(db,email,'freshPrivatePass123');assert.equal(session.mustChangePassword,false);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM private_password_resets').get()!.n,0);
  await assert.rejects(auth.resetPrivatePassword(db,email,message.resetCode,'anotherPrivatePass123'),/invalid or expired/i);
 }finally{globalThis.fetch=original;}
});

import {test} from 'node:test';import assert from 'node:assert/strict';
import {checkHQConnection,legacyHQPayload,verifiedHQUrl} from '../../src/server/hq.ts';
import {normalizeHQResult,transferStatuses} from '../../src/server/transfer.ts';
import {seed} from '../../src/adapters/demo/seed.ts';
const config={url:'https://script.google.com/macros/s/fixture/exec',secret:'fixture-secret'};
test('HQ check authenticates without IDs, business data, records or emails and identifies legacy contract',async()=>{
 const bodies:Record<string,unknown>[]=[];
 const send=(async(_url:unknown,options:RequestInit)=>{const p=JSON.parse(String(options.body));bodies.push(p);return Response.json({ok:false,error:p.webhookSecret===config.secret?'Unsupported action.':'Unauthorized.'});}) as typeof fetch;
 const result=await checkHQConnection(config,send);assert.equal(result.connected,true);assert.equal(result.protocol,'legacy');assert.equal(bodies.length,2);
 assert.ok(bodies.every(p=>p.action==='ttiConnectionCheck'&&!('driver' in p)&&!('applicationId' in p)&&!('idempotencyKey' in p)));
});
test('HQ check rejects bad secrets, ignored authentication, HTML and invalid deployed URLs',async()=>{
 const reject=(async()=>Response.json({ok:false,error:'Unauthorized.'})) as typeof fetch;
 assert.equal((await checkHQConnection(config,reject)).connected,false);
 assert.equal((await checkHQConnection(config,(async()=>Response.json({ok:false,error:'Unsupported action.'})) as typeof fetch)).connected,false);
 await assert.rejects(checkHQConnection(config,(async()=>new Response('<html>sign in</html>')) as typeof fetch));
 for(const url of ['http://script.google.com/macros/s/test/exec','https://evil.invalid/macros/s/test/exec','https://script.google.com/macros/s/test/dev','https://script.google.com/macros/s/test/exec?secret=x'])assert.throws(()=>verifiedHQUrl(url));
});
test('Mapped bridge check verifies secret while distinguishing remote activation gaps',async()=>{
 const send=(async(_url:unknown,options:RequestInit)=>{const p=JSON.parse(String(options.body));return Response.json({ok:false,error:p.secret===config.secret?'Mapping must be verified before writing.':'Unauthorized.'});}) as typeof fetch;
 assert.equal((await checkHQConnection(config,send)).protocol,'mapped_bridge');
});
test('Legacy mapping keeps name/email/phone separate and exports only confirmed qualification',()=>{
 const s=seed(),driver={...s.contacts[0],firstName:'Synthetic',lastName:'Test',email:'synthetic@invalid.test',phoneNormalized:'+12025550191'};
 const payload=legacyHQPayload('app-fixture',driver.id,{driver,recruiter:{...s.recruiter,contactEmail:'recruiter@invalid.test'},terms:s.offers[1],answers:{...s.conversations[0]?.answers,safeToTalk:true,preferredName:null,priority:null,homeState:'IL',licenseClass:'A',experienceMonths:24,employment:'1099',routePreference:'regional',homeTimePreference:'weekly',startWindow:'now'},guide:{answers:{state:'IL',experienceMonths:'24',sap:'unknown',locationZip:'Chicago | 60608'},confirmed:{state:true,experienceMonths:true,sap:false,locationZip:true},reviewReasons:{sap:'Needs verification'},lastAnswered:'locationZip'},agreement:true,createdAt:Date.parse('2026-10-02T12:00:00Z')},config.secret);
 assert.equal(payload.action,'completeApplication');assert.equal(payload.idempotencyKey,'app-fixture');assert.equal(payload.webhookSecret,config.secret);
 assert.equal(payload.driver.firstName,'Synthetic');assert.equal(payload.driver.email,'synthetic@invalid.test');assert.equal(payload.driver.phone,'+12025550191');assert.equal(payload.driver.experienceMonths,24);assert.equal(payload.driver.sapStatus,'');assert.equal(payload.driver.zipCode,'60608');assert.equal(payload.completedAtUtc,'2026-10-02T12:00:00.000Z');
});
test('Legacy acknowledgment requires CRM identity readback; notification uncertainty stays separate',()=>{
 const previous={hq:'pending',crm:'pending',notification:'disabled'};
 const r=normalizeHQResult('app-1',{ok:true,hq:{ok:true,rowNumber:9},crm:{ok:true,recordId:'app-1'},email:{status:'UNKNOWN'}},'legacy');
 const result=transferStatuses(previous,'app-1',r);assert.equal(result.synced,true);assert.equal(result.notification,'UNKNOWN');
 for(const crm of [{ok:true,recordId:'wrong'},{ok:false}])assert.equal(transferStatuses(previous,'app-1',normalizeHQResult('app-1',{hq:{ok:true,rowNumber:9},crm},'legacy')).synced,false);
});

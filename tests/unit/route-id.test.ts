import {test} from 'node:test';import assert from 'node:assert/strict';
import {createAppRscRouteMatcher} from '../../node_modules/vinext/dist/server/app-rsc-route-matching.js';
import {makeThenableParams} from '../../node_modules/vinext/dist/shims/thenable-params.js';
import {decodePageId} from '../../src/domain/route-id.ts';
import {contactWorkspaceContext} from '../../src/domain/contact-workspace.ts';
import {seed} from '../../src/adapters/demo/seed.ts';
const routes=[{pattern:'/workspace/driver/:contactId',patternParts:['workspace','driver',':contactId']},{pattern:'/workspace/:conversationId',patternParts:['workspace',':conversationId']}];
test('Production page routing opens the actual imported next contact after finishing',async()=>{
 const snapshot=seed(),id='legacy:workbook-phone-000a2234379e76863a022298';snapshot.contacts[0]={...snapshot.contacts[0],id,ownerRecruiterId:snapshot.recruiter.id};
 const matcher=createAppRscRouteMatcher(routes),path='/workspace/driver/'+encodeURIComponent(id);
 for(const matched of [matcher.matchRequestRoute(path),matcher.matchRoute(path)]){
 const {contactId}=await makeThenableParams(matched!.params) as {contactId:string};
 assert.equal(contactId,encodeURIComponent(id));assert.equal(contactWorkspaceContext(snapshot,contactId),null);
 assert.equal(contactWorkspaceContext(snapshot,decodePageId(contactId))?.contactId,id);
 assert.equal('/workspace/driver/'+encodeURIComponent(decodePageId(contactId)),path);
 }
});
test('Page IDs decode exactly once while preserving UUIDs, literal escapes and malformed captures',()=>{
 const matcher=createAppRscRouteMatcher(routes);
 for(const id of ['18557914-a743-44de-b4ad-de5e4a585751','legacy:driver','literal%3Avalue']){
 const param=matcher.matchRequestRoute('/workspace/'+encodeURIComponent(id))!.params.conversationId as string;
 assert.equal(decodePageId(param),id);
 }
 assert.equal(decodePageId('%broken'),'%broken');
});

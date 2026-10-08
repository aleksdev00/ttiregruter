import {test as base, expect, type Page} from '@playwright/test';
import { seed } from '../../src/adapters/demo/seed';
import { emptyAnswers } from '../../src/domain/rules';
import {DemoRepository} from '../../src/adapters/demo/repository';
import type { AppSnapshot, Conversation, Result } from '../../src/contracts';
// Test-only synthetic API fixture. Production has no local-storage bypass.
const fixtures=new WeakMap<Page,{raw:string;repo:DemoRepository}>();
export async function installFixture(page:Page){const f={raw:JSON.stringify({...seed(),receipts:{}}),repo:null as unknown as DemoRepository};f.repo=new DemoRepository({getItem:()=>f.raw,setItem:(_key,v)=>{f.raw=v;}});fixtures.set(page,f);await page.route('**/api/workflow',async route=>{let result:Result<unknown>;if(route.request().method()==='GET')result=await f.repo.load();else{const {method,args}=route.request().postDataJSON();const fn=f.repo[method as keyof DemoRepository] as (...args:unknown[])=>Promise<Result<unknown>>;result=await fn.apply(f.repo,args);}await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});});await page.route('**/api/operations',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,value:{role:'recruiter',applications:[],tasks:[],integrations:{hq:'Isolated synthetic fixture'}}})}));}
export const test=base.extend<{isolatedFixture:void}>({isolatedFixture:[async({page},use)=>{await installFixture(page);await use();},{auto:true}]});
export async function fixtureState(page:Page):Promise<AppSnapshot>{return JSON.parse(fixtures.get(page)!.raw);}
export async function replaceFixture(page:Page,s:AppSnapshot){fixtures.get(page)!.raw=JSON.stringify({...s,receipts:{}});}
export async function fixtureWorkspace(page:Page){const s=seed();const c:Conversation={id:'viewport-session',contactId:'DEMO-005',recruiterId:s.recruiter.id,status:'active',activeStepId:'qualification_blocked',answers:{...emptyAnswers,safeToTalk:true,homeState:'IL',licenseClass:'A',experienceMonths:24,employment:'1099',routePreference:'any',homeTimePreference:'flexible'},selectedOfferId:'pine',startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),closedAt:null,outcome:null,scriptVersion:'demo-script-v1',offerSnapshotVersion:'demo-offers-v1',revision:1};s.conversations.push(c);s.contacts[4].status='reserved';s.contacts[4].activeConversationId=c.id;await page.goto('/');await replaceFixture(page,s);await page.goto('/workspace/viewport-session');await expect(page.getByTestId('workspace')).toBeVisible();}

export async function clickScenario(page:Page,id:string){
 const {ownerFaq}=await import('../../src/content/owner-faq/engine');const item=ownerFaq.entries.find(x=>x.id===id)!;
 const assist=page.getByRole('button',{name:'Assist',exact:true});if(await assist.isVisible())await assist.click();
 await page.getByRole('button',{name:'FAQ',exact:true}).click();
 await page.getByRole('button',{name:'All categories',exact:true}).click();
 if(item.category)await page.getByRole('button',{name:ownerFaq.categories.find(c=>c.id===item.category)!.title,exact:true}).click();
 while(!await page.locator(`button[data-faq-id="${id}"]`).count())await page.getByRole('button',{name:'More questions',exact:true}).click();
 await page.locator(`button[data-faq-id="${id}"]`).click();
 await expect(page.getByText(`${id} · TEMPORARY RESPONSE`)).toBeVisible();
}

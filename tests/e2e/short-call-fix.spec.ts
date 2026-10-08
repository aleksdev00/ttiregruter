import {expect} from '@playwright/test';
import {test,fixtureState,replaceFixture,fixtureWorkspace} from './helpers';
import {emptyAnswers} from '../../src/domain/rules';
import {callGuideQuestions} from '../../src/domain/guide';
for(const role of ['recruiter','admin'])test(`Short call and visible catalog / FAQ for ${role}`,async({page})=>{
 await page.setViewportSize({width:1280,height:800});
 await page.route('**/api/work-session',async route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,value:{profile:(await fixtureState(page)).recruiter,session:{status:'active'}}})}));
 await page.route('**/api/operations',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,value:{role,applications:[],tasks:[],integrations:{}}})}));
 await page.route('**/api/application-submission?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,value:null})}));
 await fixtureWorkspace(page);let snapshot=await fixtureState(page),c=snapshot.conversations[0];
 c.activeStepId='opening';c.answers={...emptyAnswers};c.selectedOfferId=null;c.playbook=undefined;
 snapshot.offers=snapshot.offers.map(o=>({...o,isDemo:false,source:'approved_snapshot' as const,approvalStatus:'approved' as const,recruitingApproved:true,verifiedAt:new Date().toISOString()}));
 await replaceFixture(page,snapshot);await page.reload();
 const assertPanels=async()=>{await expect(page.getByText('Company offers',{exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Browse company catalog'})).toBeVisible();expect(await page.getByRole('button',{name:'Details',exact:true}).count()).toBeGreaterThan(0);await expect(page.getByLabel('Owner FAQ')).toBeVisible();const box=await page.getByText('Company offers',{exact:true}).boundingBox();expect(box!.y+box!.height).toBeLessThanOrEqual(800);expect(await page.locator('body').evaluate(el=>el.scrollWidth<=window.innerWidth)).toBe(true);};
 await assertPanels();await page.getByRole('button',{name:'Interested',exact:true}).click();
 const values:Record<string,string>={position:'Company driver',employmentType:'1099',experienceMonths:'24',sap:'no',home:'7',availability:'Two weeks'};
 for(const q of callGuideQuestions(c)){const field=page.locator(`#guide-answer-${q.id}`);await expect(field).toBeVisible();if(q.type==='select')await field.selectOption(values[q.id]);else{await field.fill(values[q.id]);await field.press('Tab');}await expect.poll(async()=>((await fixtureState(page)).conversations[0].playbook?.guide?.confirmed[q.id])).toBe(true);await assertPanels();}
 await expect.poll(async()=>(await fixtureState(page)).conversations[0].activeStepId).toBe('offer');
 expect(Object.keys((await fixtureState(page)).conversations[0].playbook!.guide!.confirmed)).toHaveLength(6);
 await page.locator('[class*="offerCard"]').filter({hasText:'DEMO Pine Logistics'}).last().getByRole('button',{name:'Provisional choice',exact:true}).click();
 await expect(page.getByText('RECRUITER APPLICATION',{exact:true})).toBeVisible();await assertPanels();await expect(page.getByRole('button',{name:'Copy application link'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Driver documents',exact:true})).toBeVisible();
});

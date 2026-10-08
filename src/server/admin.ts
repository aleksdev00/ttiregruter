import {removedCatalogCompany} from '../domain/catalog-removals.ts';
import {z} from 'zod';
import {guideQuestions} from '../domain/guide.ts';
import type {Contact,Offer} from '../contracts/index.ts';
import {requireAdmin,ServiceError,normalizePhone,type Actor} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';
import {operation} from './operations.ts';
import {effectiveCatalogOffer} from '../content/carrier-catalog/ownerCatalog.ts';

import {eligibleAssignmentSQL} from './assignment-eligibility.ts';
const id=z.string().min(1).max(160),reason=z.string().trim().min(1).max(400);
const assignment=z.object({recruiterId:id,count:z.number().int().min(1).max(5000),reason,requestId:id}).strict();
export async function searchAdminContacts(db:D1Database,a:Actor,input:unknown){
 requireAdmin(a);
 const {query,page}=z.object({query:z.string().trim().max(160),page:z.number().int().min(0).max(10000)}).strict().parse(input);
 if(!query)return {query,page:0,total:0,pageSize:25,contacts:[]};
 const terms=query.toLowerCase().split(/\s+/),phone=normalizePhone(query);
 const name="lower(COALESCE(json_extract(d.data_json,'$.firstName'),'') || ' ' || COALESCE(json_extract(d.data_json,'$.lastName'),''))";
 const where="json_extract(d.data_json,'$.rawFields.demoRemovedAt') IS NULL AND "+(phone?"d.phone=?":terms.map(()=>`${name} LIKE ? ESCAPE '\\'`).join(' AND '));
 const params=phone?[phone]:terms.map(t=>'%'+t.replace(/[\\%_]/g,'\\$&')+'%');
 const [count,rows]=await Promise.all([
  db.prepare(`SELECT COUNT(*) AS n FROM drivers d WHERE ${where}`).bind(...params).first<{n:number}>(),
  db.prepare(`SELECT d.id,d.owner_id,d.blocked,d.data_json,r.email AS recruiter_email,r.data_json AS recruiter_json FROM drivers d LEFT JOIN recruiters r ON r.id=d.owner_id WHERE ${where} ORDER BY ${name},d.id LIMIT 25 OFFSET ?`).bind(...params,page*25).all<{id:string;owner_id:string|null;blocked:number;data_json:string;recruiter_email:string|null;recruiter_json:string|null}>(),
 ]);
 return {query,page,total:count?.n??0,pageSize:25,contacts:rows.results.map(r=>{const c=JSON.parse(r.data_json) as Contact,p=r.recruiter_json?JSON.parse(r.recruiter_json):null;return {id:r.id,name:[c.firstName,c.lastName].filter(Boolean).join(' ')||'Name not recorded',phone:c.phoneRaw??c.phoneNormalized,email:c.email,city:c.city,state:c.state,status:r.blocked?'do_not_contact':c.status,recruiter:p?.alias??null,recruiterEmail:r.recruiter_email};})};
}
export async function previewAssignment(db:D1Database,a:Actor,input:unknown){
 requireAdmin(a);const p=assignment.parse(input);
 if(!(await db.prepare('SELECT id FROM recruiters WHERE id=? AND active=1').bind(p.recruiterId).first()))throw new ServiceError('Choose an active account.');
 const rows=await db.prepare(`SELECT d.id,d.data_json FROM drivers d WHERE ${eligibleAssignmentSQL} ORDER BY CASE WHEN json_extract(d.data_json,'$.nameEvidence') IN ('explicit_source','driver_confirmed') AND length(trim(COALESCE(json_extract(d.data_json,'$.firstName'),'')))>0 AND length(trim(COALESCE(json_extract(d.data_json,'$.lastName'),'')))>0 THEN 0 ELSE 1 END,d.id LIMIT ?`).bind(p.count).all<{id:string;data_json:string}>();
 return {...p,contactIds:rows.results.map(r=>r.id),available:rows.results.length,sample:rows.results.slice(0,20).map(r=>{const c=JSON.parse(r.data_json) as Contact;return {id:r.id,name:[c.firstName,c.lastName].filter(Boolean).join(' ')||'Name not recorded',phone:c.phoneRaw,state:c.state};})};
}
export async function commitAssignment(db:D1Database,a:Actor,input:unknown){
 requireAdmin(a);const p=assignment.extend({contactIds:z.array(id).min(1).max(5000)}).parse(input);
 if(new Set(p.contactIds).size!==p.contactIds.length||p.contactIds.length>p.count)throw new ServiceError('Invalid assignment preview.');
 const auditId='admin-assignment:'+p.requestId,prior=await db.prepare('SELECT data_json FROM audit WHERE id=? AND actor_id=?').bind(auditId,a.id).first<{data_json:string}>();
 if(prior){const result=JSON.parse(prior.data_json);if(JSON.stringify(result.input)!==JSON.stringify(p))throw new ServiceError('This assignment request changed.',409,'conflict');return {...result,idempotent:true};}
 if(!(await db.prepare('SELECT id FROM recruiters WHERE id=? AND active=1').bind(p.recruiterId).first()))throw new ServiceError('Choose an active account.');
 const revision=await currentRevision(db),guard=crypto.randomUUID();
 const value={input:p,assigned:p.contactIds.length,message:`${p.contactIds.length} contacts assigned.`,at:Date.now()};
 await guardedBatch(db,revision,[
  db.prepare(`INSERT INTO mutation_guards(id,ok) SELECT ?,CASE WHEN COUNT(*)=? THEN 1 ELSE 0 END FROM drivers d WHERE ${eligibleAssignmentSQL} AND d.id IN (SELECT value FROM json_each(?))`).bind(guard,p.contactIds.length,JSON.stringify(p.contactIds)),
  db.prepare("UPDATE drivers SET owner_id=?,batch_id=?,data_json=json_set(data_json,'$.ownerRecruiterId',?) WHERE id IN (SELECT value FROM json_each(?))").bind(p.recruiterId,auditId,p.recruiterId,JSON.stringify(p.contactIds)),
  db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'contacts_assigned',?,?)").bind(auditId,a.id,value.at,JSON.stringify(value)),
  db.prepare('DELETE FROM mutation_guards WHERE id=?').bind(guard),
 ]);return value;
}

export async function adminOverview(db:D1Database,a:Actor,page=0){
 requireAdmin(a);if(!Number.isSafeInteger(page)||page<0||page>10000)throw new ServiceError('Invalid activity page.');
 const [roster,counts,catalog,activity,notifications,calls]=await Promise.all([
  db.prepare("SELECT r.id,r.email,r.role,r.active,r.user_id,r.data_json,COUNT(d.id) AS assigned,SUM(CASE WHEN json_extract(d.data_json,'$.status')='available' AND d.blocked=0 AND d.duplicate=0 AND json_extract(d.data_json,'$.activeConversationId') IS NULL THEN 1 ELSE 0 END) AS available FROM recruiters r LEFT JOIN drivers d ON d.owner_id=r.id GROUP BY r.id ORDER BY r.email").all(),
  db.prepare(`SELECT COUNT(*) AS eligible FROM drivers d WHERE ${eligibleAssignmentSQL}`).first(),
  db.prepare("SELECT c.id AS companyId,c.name,c.status,c.version,COALESCE(json_extract(c.data_json,\'$.urgent\'),0) AS urgent,o.data_json AS offer FROM companies c JOIN offers o ON o.company_id=c.id WHERE json_extract(c.data_json, '$.deletedAt') IS NULL ORDER BY c.name,o.id").all(),
  db.prepare("SELECT a.id,a.type,a.at,a.data_json,r.email AS actor FROM audit a LEFT JOIN recruiters r ON r.id=a.actor_id WHERE a.type<>'workflow' ORDER BY a.at DESC,a.id DESC LIMIT 25 OFFSET ?").bind(page*25).all(),
  db.prepare("SELECT n.id,n.status,n.message,n.updated_at,c.driver_id,r.email AS recruiter,d.data_json AS driver FROM completion_notifications n JOIN conversations c ON c.id=n.conversation_id JOIN drivers d ON d.id=c.driver_id LEFT JOIN recruiters r ON r.id=c.recruiter_id ORDER BY n.updated_at DESC LIMIT 50").all(),
  db.prepare("SELECT c.id,c.status,c.data_json,r.email AS recruiter,d.data_json AS driver FROM conversations c JOIN drivers d ON d.id=c.driver_id LEFT JOIN recruiters r ON r.id=c.recruiter_id WHERE c.status IN ('closed','cancelled') ORDER BY json_extract(c.data_json,'$.updatedAt') DESC LIMIT 50").all(),
 ]);
 return {role:a.role,roster:roster.results,eligible:counts?.eligible??0,catalog:catalog.results.filter(row=>!removedCatalogCompany(String(row.companyId),String(row.name))).map(row=>({...row,offer:effectiveCatalogOffer(JSON.parse(String(row.offer)) as Offer)})),
  activity:activity.results.map(row=>{const data=JSON.parse(String(row.data_json));return {id:row.id,type:row.type,at:row.at,actor:row.actor??'System',summary:data.reason??data.input?.reason??data.evidence??(data.assigned!==undefined?`${data.assigned} contacts assigned`:data.urgent!==undefined?`Urgent hiring ${data.urgent?'enabled':'disabled'}`:data.source??'Recorded change')};}),page,
  notifications:notifications.results.map(row=>{const d=JSON.parse(String(row.driver)) as Contact;return {id:row.id,status:row.status,message:row.message,at:row.updated_at,recruiter:row.recruiter,name:[d.firstName,d.lastName].filter(Boolean).join(' ')||'Name not recorded'};}),
  calls:calls.results.map(row=>{const d=JSON.parse(String(row.driver)) as Contact,c=JSON.parse(String(row.data_json));return {id:row.id,status:row.status,outcome:c.outcome,at:c.updatedAt,recruiter:row.recruiter,name:[d.firstName,d.lastName].filter(Boolean).join(' ')||'Name not recorded'};}),
 };
}

const nullableNumber=z.number().int().nonnegative().nullable();
const option=(field:string)=>z.string().refine(v=>guideQuestions.find(q=>q.id===field)?.options.some(([value])=>value===v),`Choose a documented ${field} value.`);
const state=option('state');
const criteria=z.object({source:reason,sap:z.enum(['no_history','completed_only','consider','unknown']),trailers:z.array(option('trailer')),excludedTrailers:z.array(option('trailer')),trucks:z.array(option('truck')),routes:z.array(option('route')),excludedStates:z.array(state),excludedCities:z.array(z.string()),minimumOutDays:nullableNumber,stateMinimumOutDays:z.record(state,z.number().int().nonnegative()),minimumExperienceMonths:z.number().int().min(0).max(720).nullable(),trailerExperienceMonths:z.record(z.number().int().nonnegative()),review:z.array(z.string())});
export async function saveCompanyFields(db:D1Database,a:Actor,input:unknown){
 requireAdmin(a);const p=z.object({companyId:id,offerId:id,expectedVersion:z.number().int().nonnegative(),name:reason,status:z.enum(['active','pending_review','waiting_for_reply','prospect','paused','inactive']),source:reason,create:z.boolean().optional(),program:z.enum(['company','lease','owner_operator','unknown']).optional(),employment:z.enum(['w2','1099','lease','owner_operator','unknown']),requiredLicense:z.enum(['A','B']).nullable(),hiringStates:z.array(state).nullable(),matchingCriteria:criteria,summary:z.string().trim().min(1).max(8000),schedule:z.string().trim().min(1).max(8000),equipment:z.string().trim().min(1).max(8000),deductions:z.array(z.string()),payUnit:z.enum(['cpm','weekly','hourly','percentage','unknown']),payMin:z.number().nonnegative().nullable(),payMax:z.number().nonnegative().nullable(),payBasis:z.enum(['advertised','guaranteed','unknown']),reviewed:z.boolean()}).strict().parse(input);
 if(p.payMin!==null&&p.payMax!==null&&p.payMin>p.payMax)throw new ServiceError('Minimum pay cannot exceed maximum pay.');
 const row=await db.prepare('SELECT data_json FROM offers WHERE id=? AND company_id=?').bind(p.offerId,p.companyId).first<{data_json:string}>();const company=await db.prepare('SELECT data_json FROM companies WHERE id=?').bind(p.companyId).first<{data_json:string}>();
 if(removedCatalogCompany(p.companyId,p.name)||company&&JSON.parse(company.data_json).deletedAt)throw new ServiceError('This company was removed from the catalog.');
 if(!row&&(!p.create||p.expectedVersion!==0||company))throw new ServiceError('Company program not found.',404,'not_found');
 if(p.create&&row)throw new ServiceError('This company was already created. Reload to edit it.',409,'conflict');
 if(await db.prepare('SELECT id FROM companies WHERE lower(trim(name))=? AND id<>?').bind(p.name.trim().toLowerCase(),p.companyId).first())throw new ServiceError('A company with this name already exists.',409,'conflict');
 const o:Offer=row?effectiveCatalogOffer(JSON.parse(row.data_json) as Offer):{id:p.offerId,companyName:p.name,active:false,employment:'unknown',hiringStates:null,requiredLicense:null,minExperienceMonths:null,routeType:null,homeTime:null,pay:{unit:'unknown',min:null,max:null,currency:'USD',basis:'unknown',note:''},restrictions:[],source:'approved_snapshot',sourceRowId:null,verifiedAt:null,expiresAt:null,snapshotVersion:'0',isDemo:false};
 const program=p.program??o.documentedTerms?.program??'unknown';
 const offer:Offer={...o,companyName:p.name,employment:p.employment,requiredLicense:p.requiredLicense,hiringStates:p.hiringStates,minExperienceMonths:p.matchingCriteria.minimumExperienceMonths,matchingCriteria:{...p.matchingCriteria,source:p.source},requirements:[...(o.requirements??[]).filter(r=>r.field!=='sap'&&r.field!=='position'),...(program==='unknown'?[]:[{field:'position' as const,kind:'hard' as const,operator:'in' as const,values:[program==='company'?'Company driver':program==='lease'?'Lease':'Owner-operator'],label:'Documented program'}])],
  documentedTerms:{program,summary:p.summary,schedule:p.schedule,equipment:p.equipment,deductions:p.deductions,verification:p.matchingCriteria.review,source:p.source},pay:{...o.pay,unit:p.payUnit,min:p.payMin,max:p.payMax,basis:p.payBasis,note:p.summary},
  active:p.status==='active',recruitingApproved:p.reviewed&&p.status==='active',approvalStatus:p.reviewed?'approved':'pending_review',source:p.reviewed?'approved_snapshot':o.source,verifiedAt:p.reviewed?new Date().toISOString():null,faqFacts:{},restrictions:[...(o.restrictions??[]).filter(r=>!o.documentedTerms?.verification.includes(r)&&!o.documentedTerms?.deductions.includes(r)),...p.matchingCriteria.review,...p.deductions],
 };
 return operation(db,a,'save_catalog',{companyId:p.companyId,companyName:p.name,status:p.status,expectedVersion:p.expectedVersion,offer,verifiedBy:a.id,source:p.source});
}

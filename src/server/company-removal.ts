import {z} from 'zod';
import {requireAdmin,isAdmin,ServiceError,type Actor} from './access.ts';
import {guardedBatch,currentRevision} from './store.ts';
import {requestedCatalogRemovals} from '../domain/catalog-removals.ts';
export async function removeCompany(db:D1Database,a:Actor,input:unknown){
 requireAdmin(a);const p=z.object({companyId:z.string().min(1).max(160),expectedVersion:z.number().int().nonnegative(),reason:z.string().trim().min(1).max(400)}).strict().parse(input);
 const c=await db.prepare('SELECT * FROM companies WHERE id=?').bind(p.companyId).first<{id:string;name:string;status:string;version:number;data_json:string}>();if(!c)throw new ServiceError('Company not found.',404,'not_found');
 if(JSON.parse(c.data_json).deletedAt)return {removed:true,idempotent:true,message:'Company removed; historical records preserved.'};
 if(c.version!==p.expectedVersion)throw new ServiceError('Company changed. Reload before removing it.',409,'conflict');
 const revision=await currentRevision(db),offers=await db.prepare('SELECT * FROM offers WHERE company_id=?').bind(c.id).all(),now=Date.now();
 await guardedBatch(db,revision,[
  db.prepare("UPDATE companies SET status='inactive',version=version+1,data_json=json_set(data_json,'$.deletedAt',?,'$.deletedBy',?,'$.deletionReason',?,'$.urgent',json('false'),'$.manualEdited',json('true')) WHERE id=?").bind(now,a.id,p.reason,c.id),
  db.prepare("UPDATE offers SET version=?,data_json=json_set(data_json,'$.active',json('false'),'$.recruitingApproved',json('false'),'$.urgent',json('false'),'$.snapshotVersion',?) WHERE company_id=?").bind(String(c.version+1),String(c.version+1),c.id),
  db.prepare("UPDATE conversations SET data_json=json_set(data_json,'$.selectedOfferId',NULL,'$.playbook.flow.applicationIntent','unknown','$.revision',json_extract(data_json,'$.revision')+1) WHERE status IN ('active','paused') AND json_extract(data_json,'$.selectedOfferId') IN (SELECT id FROM offers WHERE company_id=?)").bind(c.id),
  db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'company_removed',?,?)").bind(crypto.randomUUID(),a.id,now,JSON.stringify({companyId:c.id,companyName:c.name,reason:p.reason,before:{company:c,offers:offers.results},historyPreserved:true,noExternalActions:true})),
 ]);return {removed:true,message:'Company removed; historical records preserved.'};
}
// Authorized release operation, applied once by the next authenticated admin
// request. Read-only tools cannot mutate live D1; the normal server performs it.
export async function applyRequestedCompanyRemovals(db:D1Database,a:Actor){
 if(!isAdmin(a))return;
 for(const request of requestedCatalogRemovals){const c=await db.prepare("SELECT id,version,data_json FROM companies WHERE id=? AND lower(trim(name))=?").bind(request.id,request.name.toLowerCase()).first<{id:string;version:number;data_json:string}>();if(c&&!JSON.parse(c.data_json).deletedAt)await removeCompany(db,a,{companyId:c.id,expectedVersion:c.version,reason:request.reason});}
}

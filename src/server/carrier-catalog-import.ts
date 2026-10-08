import {removedCatalogCompany} from '../domain/catalog-removals.ts';
import {ownerCatalog,ownerCatalogSource} from '../content/carrier-catalog/ownerCatalog.ts';
import {requireAdmin,ServiceError,type Actor} from './access.ts';
import {currentRevision,guardedBatch} from './store.ts';

// Authenticated server-side import only. Existing revisions are never overwritten.
export async function importCarrierCatalog(db:D1Database,bucket:R2Bucket,a:Actor,source:unknown){
 requireAdmin(a);
 const revision=await currentRevision(db);
 const [companies,offers]=await Promise.all([db.prepare('SELECT * FROM companies').all<{id:string;name:string;data_json:string}>(),db.prepare('SELECT * FROM offers').all<{id:string;company_id:string;data_json:string}>()]);
 const imported:string[]=[],matched:string[]=[],conflicts:Array<{company:string;reason:string}>=[];
 const statements:D1PreparedStatement[]=[],now=Date.now();
 for(const company of ownerCatalog){
  if(removedCatalogCompany(company.id,company.companyName)){conflicts.push({company:company.companyName,reason:'Removed by administrator; not reimported.'});continue;}
  const prior=companies.results.find(row=>row.id===company.id||row.name.trim().toLowerCase()===company.companyName.toLowerCase());
  if(prior){
   if(JSON.parse(prior.data_json).deletedAt){conflicts.push({company:company.companyName,reason:'Removed company retained for history; not reimported.'});continue;}
   const stored=offers.results.filter(row=>row.company_id===prior.id);
   if(JSON.parse(prior.data_json).sourceHash===ownerCatalogSource.sha256&&company.drafts.every(draft=>stored.some(row=>row.id===draft.id&&JSON.parse(row.data_json).sourceRowId===draft.sourceRowId)))matched.push(company.companyName);
   else conflicts.push({company:company.companyName,reason:'Existing company revision retained; owner review required.'});
   continue;
  }
  if(company.drafts.some(draft=>offers.results.some(row=>row.id===draft.id))){conflicts.push({company:company.companyName,reason:'Existing offer identifier retained; owner review required.'});continue;}
  statements.push(db.prepare('INSERT INTO companies(id,name,status,version,data_json) VALUES(?,?,?,1,?)').bind(company.id,company.companyName,'pending_review',JSON.stringify({sourceHash:ownerCatalogSource.sha256,sourceFile:ownerCatalogSource.fileName,sourceSheet:company.sheet,programs:company.programs,importedAt:now,importedBy:a.id})));
  for(const offer of company.drafts)statements.push(db.prepare('INSERT INTO offers(id,company_id,version,data_json) VALUES(?,?,1,?)').bind(offer.id,company.id,JSON.stringify(offer)));
  imported.push(company.companyName);
 }
 const summary={sourceCompanies:ownerCatalog.length,sourcePrograms:ownerCatalog.flatMap(c=>c.drafts).length,imported:imported.length,matched:matched.length,skipped:conflicts.length,failed:0,conflicts,noExternalActions:true,backupSaved:false};
 if(!statements.length)return summary;
 const prefix='carrier-catalog/'+ownerCatalogSource.sha256+'/'+crypto.randomUUID();
 await bucket.put(prefix+'/before.json',JSON.stringify({revision,companies:companies.results,offers:offers.results,summary,createdAt:now}));
 await bucket.put(prefix+'/source.json',JSON.stringify(source));
 if(!(await bucket.head(prefix+'/before.json'))||!(await bucket.head(prefix+'/source.json')))throw new ServiceError('The recoverable catalog snapshot could not be verified. Nothing was imported.',503,'storage_failed');
 statements.push(db.prepare("INSERT INTO audit(id,actor_id,type,at,data_json) VALUES(?,?,'carrier_catalog_imported',?,?)").bind(crypto.randomUUID(),a.id,now,JSON.stringify({...summary,sourceHash:ownerCatalogSource.sha256,backupKey:prefix+'/before.json',sourceKey:prefix+'/source.json'})));
 await guardedBatch(db,revision,statements);
 const ids=imported.map(name=>ownerCatalog.find(c=>c.companyName===name)!.id);
 for(const id of ids){const row=await db.prepare('SELECT id FROM companies WHERE id=?').bind(id).first();if(!row)throw new ServiceError('Catalog write verification failed. Review the import audit before retrying.',503,'storage_failed');}
 return {...summary,backupSaved:true};
}

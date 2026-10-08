import {removeCompany} from '@/src/server/company-removal';
import {z} from 'zod';
import {runtime,checkOrigin,json,failure} from '@/src/server/runtime';
import {requireAdmin,ServiceError} from '@/src/server/access';
import {adminOverview,previewAssignment,commitAssignment,saveCompanyFields,searchAdminContacts} from '@/src/server/admin';
export const dynamic='force-dynamic';
export async function GET(r:Request){try{const {db,actor}=await runtime();requireAdmin(actor);const params=new URL(r.url).searchParams;return json({ok:true,value:params.get('view')==='contacts'?await searchAdminContacts(db,actor,{query:params.get('q')??'',page:Number(params.get('page')??0)}):await adminOverview(db,actor,Number(params.get('page')??0))});}catch(e){return failure(e instanceof z.ZodError?new ServiceError(e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')):e);}}
export async function POST(r:Request){try{checkOrigin(r);const {db,actor}=await runtime();requireAdmin(actor);const p=z.object({action:z.enum(['preview_assignment','assign_preview','save_company_fields','remove_company']),input:z.unknown()}).strict().parse(await r.json());const value=await (p.action==='preview_assignment'?previewAssignment(db,actor,p.input):p.action==='assign_preview'?commitAssignment(db,actor,p.input):p.action==='remove_company'?removeCompany(db,actor,p.input):saveCompanyFields(db,actor,p.input));return json({ok:true,value});}catch(e){return failure(e instanceof z.ZodError?new ServiceError(e.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')):e);}}

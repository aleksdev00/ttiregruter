import {env} from '@/src/server/platform';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {failure,checkOrigin} from '@/src/server/runtime';
import {ServiceError} from '@/src/server/access';
import {requireExportIdentity} from '@/src/server/export/database';
import {createRun,exportPart,getRun,manifest,releaseRun} from '@/src/server/export/staged';
import {bucketArchive} from '@/src/server/export/files';
export const dynamic='force-dynamic';
async function authorized(){const user=await getChatGPTUser();if(!env.DB)throw new ServiceError('Database unavailable.',503);
 const record=user?await env.DB.prepare('SELECT r.email,r.role,r.active,b.auth_user_id AS user_id FROM recruiters r JOIN recruiter_login_bindings b ON b.recruiter_id=r.id WHERE b.auth_user_id=? AND lower(r.email)=? AND lower(b.verified_email)=lower(r.email)').bind(user.userId,user.email.toLowerCase()).first<{email:string;role:string;active:number;user_id:string|null}>():null;
 requireExportIdentity(user,record);return {db:env.DB,user:user!};}
export async function GET(request:Request){try{
 const {db,user}=await authorized();
 const kind=new URL(request.url).searchParams.get('kind')??'database';
 const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
 if(kind==='files'){
  if(!env.BUCKET)throw new ServiceError('Document storage is unavailable.',503);
  return new Response(await bucketArchive(env.BUCKET),{headers:{...headers,'content-type':'application/zip','content-disposition':'attachment; filename="TTI-R2-files.zip"'}});
 }
 const p=new URL(request.url).searchParams;
 if(kind==='manifest')return Response.json({ok:true,value:await manifest(db,await getRun(db,user.userId,p.get('run')??''))},{headers});
 if(kind==='part'){const raw=p.get('offset')??'';if(!/^\d+$/.test(raw))throw new ServiceError('Invalid export cursor.');return Response.json({ok:true,value:await exportPart(db,user.userId,p.get('run')??'',p.get('table')??'',Number(raw))},{headers});}
 if(kind==='database')return Response.redirect(new URL('/admin/export',request.url),303);
 throw new ServiceError('Choose database or files.');
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 checkOrigin(request);const {db,user}=await authorized();
 if(Number(request.headers.get('content-length')??0)>1024)throw new ServiceError('Invalid export request.');
 const input=await request.json() as {action?:string;run?:string};
 if(input.action==='create')return Response.json({ok:true,value:await createRun(db,user.userId)},{headers:{'cache-control':'private, no-store'}});
 if(input.action==='release'&&typeof input.run==='string'){await releaseRun(db,user.userId,input.run);return Response.json({ok:true},{headers:{'cache-control':'private, no-store'}});}
 throw new ServiceError('Invalid export action.');
 }catch(e){return failure(e);}}

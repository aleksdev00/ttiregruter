import {applyOwnerReferrals} from './owner-referral-links';
import {applyRequestedCompanyRemovals} from './company-removal';
import {env} from './platform';
import {getPrivateUser} from './private-auth';
import {ServiceError} from './access';
export async function runtime(_requireShift=true){if(!env.DB)throw new ServiceError('Application database is not configured.',503,'not_configured');const user=await getPrivateUser(env.DB);if(!user)throw new ServiceError('Sign in with your approved recruiter account.',401,'not_allowed');if(user.mustChangePassword)throw new ServiceError('Choose a new password before continuing.',403,'password_change_required');const actor=user.actor;await applyRequestedCompanyRemovals(env.DB,actor);await applyOwnerReferrals(env.DB,actor);return {db:env.DB,actor};}
export function failure(e:unknown){const known=e instanceof ServiceError;return Response.json({ok:false,code:known?e.code:'storage_failed',message:known?e.message:'The operation could not be saved. Reload and retry.'},{status:known?e.status:503,headers:{'cache-control':'private, no-store'}});}
export function checkOrigin(r:Request){const origin=r.headers.get('origin');if(!origin||origin!==new URL(r.url).origin||r.headers.get('sec-fetch-site')==='cross-site')throw new ServiceError('Same-origin request required.',403,'not_allowed');}
export const json=(v:unknown)=>Response.json(v,{headers:{'cache-control':'private, no-store'}});

export function checkAuthOrigin(r:Request){checkOrigin(r);if(Number(r.headers.get('content-length')??0)>16384)throw new ServiceError('Authentication request is too large.',413,'invalid_input');}

export async function authBody(request:Request):Promise<Record<string,unknown>>{
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ServiceError('Use a JSON authentication request.',415,'invalid_input');
 const reader=request.body?.getReader();if(!reader)throw new ServiceError('Authentication details are required.');
 const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>16384){await reader.cancel();throw new ServiceError('Authentication request is too large.',413,'invalid_input');}chunks.push(part.value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
 let value:unknown;try{value=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new ServiceError('Authentication request is invalid.');}
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceError('Authentication request is invalid.');return value as Record<string,unknown>;
}

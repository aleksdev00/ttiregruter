import {privateReviewActor} from './private-review-bootstrap';
import {env} from '@/src/server/platform';
import {getPrivateUser} from './private-auth';
import {ServiceError} from './access';
export async function runtime(_requireShift=true){if(!env.DB)throw new ServiceError('Private test database is unavailable.',503,'not_configured');const user=await getPrivateUser(env.DB);if(!user)throw new ServiceError('Sign in with your private test email and password.',401,'not_allowed');const actor=await privateReviewActor(env.DB,user);return {db:env.DB,actor};}
export function failure(e:unknown){const known=e instanceof ServiceError;return Response.json({ok:false,code:known?e.code:'storage_failed',message:known?e.message:'The operation could not be saved. Reload and retry.'},{status:known?e.status:503,headers:{'cache-control':'private, no-store'}});}
export function checkOrigin(r:Request){const origin=r.headers.get('origin');if(!origin||origin!==new URL(r.url).origin)throw new ServiceError('Same-origin request required.',403,'not_allowed');}
export const json=(v:unknown)=>Response.json(v,{headers:{'cache-control':'private, no-store'}});

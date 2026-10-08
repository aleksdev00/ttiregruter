import {env} from 'cloudflare:workers';
import {json,failure} from '@/src/server/runtime';
import {ServiceError} from '@/src/server/access';
import {provisionInvitedRecruiters,validProvisionSecret} from '@/src/server/invited-recruiters';
export const dynamic='force-dynamic';
// A temporary service credential permits only the fixed owner-authorized batch.
// Visitor identity and ordinary operations still require the existing login.
export async function POST(r:Request){try{
 const config=env as unknown as {DB:D1Database;INVITED_RECRUITER_SETUP_SECRET?:string};
 if(!await validProvisionSecret(config.INVITED_RECRUITER_SETUP_SECRET,r.headers.get('x-tti-setup-secret')??''))throw new ServiceError('Setup is disabled or unauthorized.',403,'not_allowed');
 return json({ok:true,value:await provisionInvitedRecruiters(config.DB)});
}catch(e){return failure(e);}}

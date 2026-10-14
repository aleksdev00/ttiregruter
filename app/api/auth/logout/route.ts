import {env} from '@/src/server/platform';import {ServiceError} from '@/src/server/access';import {checkAuthOrigin,failure,json} from '@/src/server/runtime';import {revokePrivateSession} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{checkAuthOrigin(r);if(!env.DB)throw new ServiceError('Application database is not configured.',503,'not_configured');await revokePrivateSession(env.DB);return json({ok:true});}catch(e){return failure(e);}}

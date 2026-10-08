import {env} from 'cloudflare:workers';
import {checkOrigin,failure} from '@/src/server/runtime';
import {revokePrivateSession} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function POST(r:Request){try{checkOrigin(r);if(!env.DB)throw new Error('Private test database unavailable.');await revokePrivateSession(env.DB);return Response.json({ok:true},{headers:{'cache-control':'no-store'}});}catch(e){return failure(e);}}

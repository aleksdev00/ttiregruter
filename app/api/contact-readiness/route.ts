import {env} from '@/src/server/platform';
import {runtime,checkOrigin,json,failure} from '@/src/server/runtime';
import {ServiceError} from '@/src/server/access';
import {releaseImportedContacts} from '@/src/server/contact-readiness';
export async function POST(request:Request){try{checkOrigin(request);const {db,actor}=await runtime();if(!env.BUCKET)throw new ServiceError('Private contact backup storage is unavailable.',503,'not_configured');return json({ok:true,value:await releaseImportedContacts(db,env.BUCKET,actor,await request.json())});}catch(e){return failure(e);}}

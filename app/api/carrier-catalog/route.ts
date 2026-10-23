import {env} from '@/src/server/platform';
import {runtime,checkOrigin,failure,json} from '@/src/server/runtime';
import {ServiceError} from '@/src/server/access';
import {importCarrierCatalog} from '@/src/server/carrier-catalog-import';
import {ownerCatalog,ownerCatalogSource} from '@/src/content/carrier-catalog/ownerCatalog';
export const dynamic='force-dynamic';
export async function POST(request:Request){try{checkOrigin(request);const {db,actor}=await runtime();if(!env.BUCKET)throw new ServiceError('Private catalog backup storage is unavailable.',503,'not_configured');const source={source:ownerCatalogSource,records:ownerCatalog};return json({ok:true,value:await importCarrierCatalog(db,env.BUCKET,actor,source)});}catch(error){return failure(error);}}

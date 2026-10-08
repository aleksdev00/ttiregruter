import handler from 'vinext/server/fetch-handler';
import {runWithConnectorBinding} from '../lib/connector-context';
const allowed=new Set(['/api/workflow','/api/work-session','/api/identity','/api/operations','/api/admin','/api/conversation-history','/api/auth/status','/api/auth/login','/api/auth/setup','/api/auth/logout']);
export default {async fetch(request:Request,env:Cloudflare.Env,ctx:ExecutionContext){
 const path=new URL(request.url).pathname;
 if(path==='/api/private-test-health')return Response.json({privateTest:true,syntheticContacts:500,externalActions:'disabled',productionDatabase:'not connected'});
 if(path.startsWith('/api/')&&!allowed.has(path))return Response.json({ok:false,code:'not_allowed',message:'External delivery, applications, documents and integrations are disabled in this isolated private test.'},{status:403});
 return runWithConnectorBinding(undefined,()=>handler.fetch(request,env,ctx));
}};

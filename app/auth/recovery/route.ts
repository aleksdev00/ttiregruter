import {beginRecovery} from '@/src/server/private-auth';
export const dynamic='force-dynamic';
export async function GET(request:Request){const url=new URL(request.url);if(url.searchParams.get('type')!=='recovery')return Response.redirect(new URL('/login?recovery=invalid',url),303);try{await beginRecovery(url.searchParams.get('token_hash')??'');return Response.redirect(new URL('/reset-password',url),303);}catch{return Response.redirect(new URL('/login?recovery=invalid',url),303);}}

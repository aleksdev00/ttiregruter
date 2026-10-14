export const SESSION_MS = 24 * 60 * 60 * 1000;
export const PRESENCE_MS = 90 * 1000;
export function sessionValid(createdAt:number,expiresAt:number,now=Date.now()) {
 return Number.isFinite(createdAt)&&createdAt<=now&&now<Math.min(expiresAt,createdAt+SESSION_MS);
}
export function safeReturnPath(value:string|undefined) {
 if(!value||!value.startsWith('/')||/[\\\r\n]/.test(value)||value.startsWith('//'))return '/';
 try {const url=new URL(value,'https://tti.invalid');return url.origin==='https://tti.invalid'?url.pathname+url.search+url.hash:'/';}catch{return '/';}
}
export function validateMutationRequest(request:Request) {
 const origin=request.headers.get('origin');
 if(origin!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')throw Error('Same-origin request required.');
 const length=Number(request.headers.get('content-length')??0);
 if(length>256*1024)throw Error('Request exceeds the 256 KB limit.');
}
export function securityHeaders(response:Response) {
 const h=new Headers(response.headers);
 h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','strict-origin-when-cross-origin');
 h.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 // React/Vinext emits inline bootstrapping. Script nonces require framework
 // integration; do not claim strict script-XSS coverage from this policy.
 h.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com");
 if((response.headers.get('content-type')??'').includes('json'))h.set('Cache-Control','private, no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:h});
}

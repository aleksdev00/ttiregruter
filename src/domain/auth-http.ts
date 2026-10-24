export class AuthTransportError extends Error {
 code:'site_access'|'invalid_response'|'connection';
 constructor(message:string,code:'site_access'|'invalid_response'|'connection'){super(message);this.code=code;}
}
type Envelope<T>={ok:boolean;value?:T;message?:string};
const AUTH_API='/api/auth';
export async function readAuthResponse<T>(response:Response):Promise<Envelope<T>> {
 if(response.type==='opaqueredirect'||response.redirected||response.status>=300&&response.status<400)
  throw new AuthTransportError('Sign-in was redirected. Reload the application and try again.','site_access');
 const contentType=response.headers.get('content-type')??'';
 if(!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(contentType))
  throw new AuthTransportError('The sign-in service returned a webpage instead of a login result. Reload this page, then try again.','site_access');
 let result:unknown;
 try{result=await response.json();}catch{throw new AuthTransportError('The sign-in service returned an invalid response. Reload and retry.','invalid_response');}
 if(!result||typeof result!=='object'||!('ok' in result)||typeof result.ok!=='boolean')
  throw new AuthTransportError('The sign-in service returned an invalid response. Reload and retry.','invalid_response');
 const envelope=result as Envelope<T>;
 if(!response.ok||!envelope.ok)throw Error(typeof envelope.message==='string'?envelope.message.slice(0,400):'Sign in was not confirmed. Retry.');
 return envelope;
}
export async function authRequest<T>(action:'login'|'forgot-password'|'reset-password'|'change-password'|'logout',body?:unknown):Promise<Envelope<T>> {
 let response:Response;
 try{response=await fetch(`${AUTH_API}/${action}`,{method:'POST',credentials:'same-origin',redirect:'manual',cache:'no-store',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(body??{})});}
 catch{throw new AuthTransportError('The sign-in service could not be reached. Your entered information is preserved; reconnect Site access or retry.','connection');}
 const result=await readAuthResponse<T>(response);
 if(action==='login'&&(!result.value||typeof result.value!=='object'||!('mustChangePassword' in result.value)||typeof result.value.mustChangePassword!=='boolean'))
  throw new AuthTransportError('Sign in was not confirmed by the service. Reload and retry.','invalid_response');
 return result;
}

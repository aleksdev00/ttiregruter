import type {Result} from '../contracts/index.ts';
// Completion retries use the same opaque identity, without putting a driver's
// callback date (including punctuation rejected by the server) in the key.
export async function completionRequestId(conversationId:string,outcome:string,callbackAt:string|null):Promise<string>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([conversationId,outcome,callbackAt])));
 return 'finish-'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
// A timeout cannot prove whether the write committed. Preserve the same request
// identity for retries and reconcile persisted state before navigating.
export async function awaitMutation<T>(operation:Promise<Result<T>>,timeoutMs=20000):Promise<Result<T>>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([operation,new Promise<Result<T>>(resolve=>{timer=setTimeout(()=>resolve({ok:false,code:'storage_failed',message:'Save confirmation timed out. Reload saved data or retry the same action. Completion has not been confirmed.'}),timeoutMs);})]);}
 finally{clearTimeout(timer);}
}
// Navigation must only consume the refreshed state. For an uncertain write,
// only an operation-specific persisted-state check can establish success.
export async function confirmedSnapshot<T>(action:()=>Promise<Result<unknown>>,load:()=>Promise<Result<T>>,reconcile?:(snapshot:T)=>boolean,timeoutMs=20000):Promise<Result<T>>{
 let result:Result<unknown>;
 try{result=await awaitMutation(action(),timeoutMs);}catch{result={ok:false,code:'storage_failed',message:'Could not confirm saving. Retry the same action.'};}
 if(result.ok)return load();
 if(result.code==='storage_failed'&&reconcile){const saved=await load();if(saved.ok&&reconcile(saved.value))return saved;}
 return result;
}

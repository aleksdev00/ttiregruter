import {mergeConfirmedSnapshot} from '../../domain/snapshot-patch.ts';
import type {RecruiterRepository,AppSnapshot,Result,Conversation} from '../../contracts';
export class ServerRepository implements RecruiterRepository {
 private snapshot:AppSnapshot|null=null;private confirmed=false;private cycle:{start:number;postMs:number;bytes:number;mode:string;method:string;serverMs:number}|null=null;
 private report(requests:number){if(!this.cycle||typeof window==='undefined')return;window.dispatchEvent(new CustomEvent('tti-private-performance',{detail:{...this.cycle,requests,totalMs:performance.now()-this.cycle.start}}));this.cycle=null;}
 async invoke<T>(method:string,args:unknown[]):Promise<Result<T>>{try{
  const mode=typeof window!=='undefined'?localStorage.getItem('tti-private-performance-mode')??'optimized':'optimized',start=performance.now();this.confirmed=false;
  const r=await fetch('/api/workflow',{method:'POST',headers:{'content-type':'application/json','X-TTI-Perf-Mode':mode},body:JSON.stringify({method,args}),cache:'no-store'}),text=await r.text(),result=JSON.parse(text) as Result<T>&{snapshotPatch?:AppSnapshot;privateMetrics?:{serverMs:number}};
  this.cycle={start,postMs:performance.now()-start,bytes:new TextEncoder().encode(text).length,mode,method,serverMs:result.privateMetrics?.serverMs??0};
  if(r.ok&&result.ok&&result.snapshotPatch&&this.snapshot){this.snapshot=mergeConfirmedSnapshot(this.snapshot,result.snapshotPatch);this.confirmed=true;}
  return result;
 }catch{this.confirmed=false;return {ok:false,code:'storage_failed',message:'Connection interrupted. Retry the same action or reload saved records.'};}}
 async load():Promise<Result<AppSnapshot>>{try{
  if(this.confirmed&&this.snapshot){this.confirmed=false;this.report(1);return {ok:true,value:this.snapshot};}
  const r=await fetch('/api/workflow',{cache:'no-store'}),text=await r.text(),result=JSON.parse(text) as Result<AppSnapshot>;
  if(result.ok){this.snapshot=result.value;if(this.cycle){this.cycle.bytes+=new TextEncoder().encode(text).length;this.report(2);}}
  return result;
 }catch{return {ok:false,code:'storage_failed',message:'Unable to load shared records.'};}}

 claimContact(...args:Parameters<RecruiterRepository['claimContact']>):Promise<Result<Conversation>>{return this.invoke('claimContact',args);}
 saveAnswers(...args:Parameters<RecruiterRepository['saveAnswers']>):Promise<Result<Conversation>>{return this.invoke('saveAnswers',args);}
 correctName(...args:Parameters<RecruiterRepository['correctName']>):Promise<Result<Conversation>>{return this.invoke('correctName',args);}
 recordAttempt(...args:Parameters<RecruiterRepository['recordAttempt']>):Promise<Result<string>>{return this.invoke('recordAttempt',args);}
 recordConnected(...args:Parameters<RecruiterRepository['recordConnected']>):Promise<Result<void>>{return this.invoke('recordConnected',args);}
 selectOffer(...args:Parameters<RecruiterRepository['selectOffer']>):Promise<Result<Conversation>>{return this.invoke('selectOffer',args);}
 pause(...args:Parameters<RecruiterRepository['pause']>):Promise<Result<Conversation>>{return this.invoke('pause',args);}
 resume(...args:Parameters<RecruiterRepository['resume']>):Promise<Result<Conversation>>{return this.invoke('resume',args);}
 cancelBeforeAttempt(...args:Parameters<RecruiterRepository['cancelBeforeAttempt']>):Promise<Result<void>>{return this.invoke('cancelBeforeAttempt',args);}
 finish(...args:Parameters<RecruiterRepository['finish']>):Promise<Result<Conversation>>{return this.invoke('finish',args);}
 conversationAction(...args:Parameters<RecruiterRepository['conversationAction']>):Promise<Result<Conversation>>{return this.invoke('conversationAction',args);}
 selectObjection(...args:Parameters<RecruiterRepository['selectObjection']>):Promise<Result<Conversation>>{return this.invoke('selectObjection',args);}
 saveOutcomeDraft(...args:Parameters<RecruiterRepository['saveOutcomeDraft']>):Promise<Result<Conversation>>{return this.invoke('saveOutcomeDraft',args);}
 saveGuideAnswer(...args:Parameters<RecruiterRepository['saveGuideAnswer']>):Promise<Result<Conversation>>{return this.invoke('saveGuideAnswer',args);}
 saveCallNotes(...args:Parameters<RecruiterRepository['saveCallNotes']>):Promise<Result<Conversation>>{return this.invoke('saveCallNotes',args);}
 saveCommunicationPermission(...args:Parameters<RecruiterRepository['saveCommunicationPermission']>):Promise<Result<Conversation>>{return this.invoke('saveCommunicationPermission',args);}
 recordCommunication(...args:Parameters<RecruiterRepository['recordCommunication']>):Promise<Result<Conversation>>{return this.invoke('recordCommunication',args);}
 suppressContact(...args:Parameters<RecruiterRepository['suppressContact']>):Promise<Result<Conversation>>{return this.invoke('suppressContact',args);}
 async simulateApplication():Promise<Result<string>>{return {ok:false,code:'not_allowed',message:'Application receipt requires independent verification.'};}
 async resetDemo():Promise<Result<AppSnapshot>>{return {ok:false,code:'not_allowed',message:'Shared business records cannot be reset from the recruiter workspace.'};}
}

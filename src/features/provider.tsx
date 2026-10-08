'use client';
import {ShiftGate} from './ShiftGate';
import { useRouter, usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { AppSnapshot, Result, Recruiter } from '../contracts';
import {confirmedSnapshot} from '../domain/operation';
import { ServerRepository } from '../adapters/server/repository';
import type {RecruiterRepository} from '../contracts';
interface Context { snapshot:AppSnapshot|null; repo:RecruiterRepository|null; busy:boolean; error:string|null; notice:string|null; run:(action:()=>Promise<Result<unknown>>,after?:(snapshot:AppSnapshot)=>void,reconcile?:(snapshot:AppSnapshot)=>boolean)=>Promise<void>; reload:()=>Promise<void>; reset:()=>Promise<void>; retry:()=>Promise<void> }
const DemoContext=createContext<Context|null>(null);
export function DemoProvider({children}:{children:React.ReactNode}) {
  const router=useRouter(); const pathname=usePathname();
  const [snapshot,setSnapshot]=useState<AppSnapshot|null>(null),[repo]=useState<RecruiterRepository>(()=>new ServerRepository()),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [shiftReady,setShiftReady]=useState(false),[shiftProfile,setShiftProfile]=useState<Recruiter|null>(null),[shiftChecked,setShiftChecked]=useState(false);
  const locked=useRef(false),retry=useRef<(()=>Promise<void>)|null>(null);
  const accept=useCallback((r:Result<AppSnapshot>)=>{if(r.ok){setSnapshot(r.value);setError(null);}else setError(r.message);},[]);
  const loadRepo=useCallback(async(current:RecruiterRepository)=>{accept(await current.load());},[accept]);
  // A hosted access/storage failure must never be disguised as synthetic data.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(()=>{void fetch('/api/work-session',{cache:'no-store'}).then(async r=>await r.json() as {ok:boolean;message:string;value:{profile:Recruiter;session:{status:string}|null}}).then(async p=>{if(!p.ok){setError(p.message);setShiftChecked(true);return;}setShiftProfile(p.value.profile);setShiftChecked(true);if(p.value.session?.status==='active'){setShiftReady(true);await loadRepo(repo);}}).catch(()=>{setError('Could not check daily approval. Reload to retry.');setShiftChecked(true);});},[loadRepo,repo]);
  const reload=async()=>{await loadRepo(repo);};
  const run=async(action:()=>Promise<Result<unknown>>,after?:(snapshot:AppSnapshot)=>void,reconcile?:(snapshot:AppSnapshot)=>boolean)=>{
    if(locked.current)return;locked.current=true;setBusy(true);setError(null);setNotice(null);
    retry.current=()=>run(action,after,reconcile);
    try {const loaded=await confirmedSnapshot(action,()=>repo.load(),reconcile);if(loaded.ok){const old=snapshot?.conversations.find(c=>['active','paused'].includes(c.status));const updated=loaded.value.conversations.find(c=>c.id===old?.id);if(old?.selectedOfferId&&!updated?.selectedOfferId)setNotice('Selection cleared: driver answers changed. Review offers and reconfirm the company.');accept(loaded);retry.current=null;after?.(loaded.value);}else setError(loaded.message);}
    catch {setError('Could not save. Retry.');}finally{locked.current=false;setBusy(false);}
  };
  const reset=async()=>{if(!window.confirm('Reset only this TTI Recruiter demo? All saved synthetic conversations will be removed.'))return;await run(()=>repo.resetDemo(),()=>{router.push('/');});};
  return <DemoContext.Provider value={{snapshot,repo,busy,error,notice,run,reload,reset,retry:async()=>{await retry.current?.();}}}>{shiftChecked&&shiftProfile&&!shiftReady?<ShiftGate profile={shiftProfile} onApproved={async()=>{setShiftReady(true);await loadRepo(repo);}}/>:!snapshot?<main style={{padding:32,maxWidth:700}}><h1>TTI Recruiting</h1><p role={error?'alert':'status'} style={{margin:'24px 0'}}>{error??'Loading your assigned contacts…'}</p>{error&&<><button onClick={()=>void reload()}>Retry loading</button> <a href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in</a> <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out / change account</a></>}</main>:<>{children}{error&&!pathname.startsWith("/workspace/")&&<div className="save-error" role="alert">{error} <button onClick={()=>void retry.current?.()}>Retry</button><button onClick={()=>void reload()}>Reload saved data</button></div>}</>}</DemoContext.Provider>;
}
export function useDemo(){const c=useContext(DemoContext);if(!c)throw new Error('Demo provider missing');return c;}
export function request(id:string,revision?:number){return {requestId:id,expectedRevision:revision};}

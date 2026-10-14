'use client';
import {useRef,useState} from 'react';
type Manifest={id:string;createdAt:number;expiresAt:number;tables:{name:string;count:number}[];header:string;footer:string};
type Part={sql:string;rows:number;nextOffset:number;sha256:string};
async function api<T>(url:string,body?:unknown):Promise<T>{const r=await fetch(url,{cache:'no-store',...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});let p:{ok:boolean;value:T;message?:string};try{p=await r.json();}catch{throw Error('The server interrupted the export. Sign in again and retry the same snapshot.');}if(!r.ok||!p.ok)throw Error(p.message||'Export failed. Retry.');return p.value;}
export function ExportControls(){
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState(''),[run,setRun]=useState<Manifest|null>(null);const lock=useRef(false);
 const download=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  setStatus('Preparing a consistent server snapshot. This can briefly slow database operations.');
  const snapshot=await api<Manifest>('/api/admin-export',{action:'create'});setRun(snapshot);
  const total=snapshot.tables.reduce((n,t)=>n+t.count,0),chunks:BlobPart[]=[snapshot.header];let complete=0;
  for(const table of snapshot.tables){let offset=0;
   while(offset<table.count){setStatus('Snapshot '+new Date(snapshot.createdAt).toLocaleString()+' — '+table.name+': '+offset+'/'+table.count+'; total '+complete+'/'+total+' records');
    const p=new URLSearchParams({kind:'part',run:snapshot.id,table:table.name,offset:String(offset)});
    const part=await api<Part>('/api/admin-export?'+p.toString());
    const bytes=new TextEncoder().encode(part.sql),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(part.rows<=0||part.nextOffset!==offset+part.rows||part.nextOffset>table.count||digest!==part.sha256)throw Error('A chunk failed completeness or integrity verification. No complete file was downloaded. Retry.');
    chunks.push(bytes);offset=part.nextOffset;complete+=part.rows;
   }
  }
  const confirmed=await api<Manifest>('/api/admin-export?'+new URLSearchParams({kind:'manifest',run:snapshot.id}));
  if(complete!==total||JSON.stringify(confirmed.tables)!==JSON.stringify(snapshot.tables))throw Error('Snapshot counts changed. No complete file was downloaded.');
  chunks.push(snapshot.footer);const blob=new Blob(chunks,{type:'application/sql;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='TTI-live-complete-supabase.sql';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  setStatus('Complete SQL assembled: '+complete+' records across '+snapshot.tables.length+' tables. Browser download started. Keep the file private.');
 }catch(e){setError(e instanceof Error?e.message:'Export failed.');setStatus('Original data is preserved. If a snapshot was created, retry uses it until it expires or is removed.');}finally{setBusy(false);lock.current=false;}};
 const release=async()=>{if(!run||lock.current)return;lock.current=true;setBusy(true);setError('');try{await api('/api/admin-export',{action:'release',run:run.id});setRun(null);setStatus('Temporary snapshot removed. Original application records remain intact. A new export captures current data.');}catch(e){setError(e instanceof Error?e.message:'Could not remove temporary snapshot.');}finally{lock.current=false;setBusy(false);}};
 return <section><button onClick={()=>void download()} disabled={busy}>{busy?'Export in progress…':'Download complete Supabase SQL'}</button>{run&&<button style={{marginLeft:12}} onClick={()=>void release()} disabled={busy}>Remove temporary snapshot</button>}<p role='status' style={{overflowWrap:'anywhere'}}>{status}</p>{error&&<p role='alert' style={{color:'#d52a2a',overflowWrap:'anywhere'}}>{error}</p>}</section>;
}

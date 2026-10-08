'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
type Metrics={totalMs:number;postMs:number;serverMs:number;requests:number;bytes:number;method:string;mode:string};
export function PrivatePerformanceBar(){
 const router=useRouter();const [mode,setMode]=useState('optimized'),[metrics,setMetrics]=useState<Metrics|null>(null);
 useEffect(()=>{setMode(localStorage.getItem('tti-private-performance-mode')??'optimized');const update=(e:Event)=>setMetrics((e as CustomEvent<Metrics>).detail);window.addEventListener('tti-private-performance',update);return()=>window.removeEventListener('tti-private-performance',update);},[]);
 return <aside style={{padding:'12px 24px',background:'#fff3cd',borderBottom:'2px solid #b87800',display:'flex',gap:16,flexWrap:'wrap',alignItems:'center'}}><strong>PRIVATE PERFORMANCE TEST</strong><span>500 synthetic contacts · Separate database · Auth emails only · No driver outreach, HQ writes or calls</span><label>Save mode <select value={mode} onChange={e=>{setMode(e.target.value);localStorage.setItem('tti-private-performance-mode',e.target.value);setMetrics(null);}}><option value='optimized'>Optimized</option><option value='baseline'>Current flow (baseline)</option></select></label>{metrics&&<span role='status'>Last save: {Math.round(metrics.totalMs)} ms · {metrics.requests} request{metrics.requests!==1?'s':''} · {Math.round(metrics.bytes/1024)} KB · server {Math.round(metrics.serverMs)} ms</span>}<button onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});router.replace('/login');router.refresh();}} style={{marginLeft:'auto',padding:'8px 12px'}}>Sign out</button></aside>;
}

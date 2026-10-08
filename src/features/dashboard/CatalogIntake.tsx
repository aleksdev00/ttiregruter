'use client';
import {useState} from 'react';
import {catalogCounts,ownerCatalog,ownerCatalogSource} from '../../content/carrier-catalog/ownerCatalog.ts';
import type {Offer} from '../../contracts/index.ts';

export function CatalogIntake({onPrepare,onImported}:{onPrepare:(companyId:string,companyName:string,offer:Offer,source:string)=>void;onImported:()=>Promise<void>}){
 const [importing,setImporting]=useState(false),[result,setResult]=useState('');
 const importWorkbook=async()=>{if(importing)return;setImporting(true);try{const response=await fetch('/api/carrier-catalog',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});const wire=await response.json() as {ok:boolean;message:string;value:{sourceCompanies:number;imported:number;matched:number;skipped:number;failed:number;backupSaved?:boolean}};if(!wire.ok)throw new Error(wire.message);const r=wire.value;setResult(`${r.sourceCompanies} source carriers · ${r.imported} imported · ${r.matched} already present · ${r.skipped} conflicts · ${r.failed} failed. ${r.backupSaved?'Recoverable backup saved.':''} No applications or messages sent.`);await onImported();}catch(error){setResult(error instanceof Error?error.message:'Import failed. Retry.');}finally{setImporting(false);}};
 const [companyId,setCompanyId]=useState(ownerCatalog[0]?.id??'');
 const record=ownerCatalog.find(item=>item.id===companyId)??ownerCatalog[0];
 const counts=catalogCounts();
 return <section aria-label="Owner carrier workbook intake" style={{border:'1px solid #cad6e2',borderRadius:10,padding:14,margin:'16px 0'}}>
  <h3>Owner workbook intake</h3>
  <button disabled={importing} onClick={()=>void importWorkbook()}>{importing?'Importing carrier catalog…':'Import supplied carrier workbook'}</button>
  <p role="status">{result}</p>
  <p>{counts.companies} carriers · {counts.explicitPrograms} explicitly listed programs · {counts.reviewableDrafts} structurally reviewable drafts.</p>
  <p>Source fingerprint: {ownerCatalogSource.sha256.slice(0,12)}. Imported programs appear for provisional discussion. Current openings and individual approval require verification.</p>
  <label>Carrier from owner workbook<select value={companyId} onChange={event=>setCompanyId(event.target.value)}>{ownerCatalog.map(item=><option key={item.id} value={item.id}>{item.companyName}</option>)}</select></label>
  {record&&<div>
   <p><strong>Workbook summary:</strong> {record.offerSummary}</p>
   <p><strong>Route:</strong> {record.routeSummary}</p>
   <p><strong>Programs:</strong> Company {record.programs.company}; Lease {record.programs.lease}; Owner operator {record.programs.owner_operator}.</p>
   <p><strong>Needs verification:</strong> {record.verificationNotes.join(' ')}</p>
   {record.drafts.length?<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{record.drafts.map(offer=><button key={offer.id} type="button" onClick={()=>onPrepare(record.id,record.companyName,offer,`${ownerCatalogSource.fileName} · ${ownerCatalogSource.sheet} · SHA-256 ${ownerCatalogSource.sha256}`)}>Prepare {offer.employment.replaceAll('_',' ')} review</button>)}</div>:<p>No safe offer draft can be generated yet. Verify the program and W-2/1099 classification first.</p>}
  </div>}
 </section>;
}

'use client';
import {useMemo,useState} from 'react';
import type {Offer,CarrierCriteria} from '../../contracts';
import {parseXlsx,buildWorkbookOfferDrafts,type WorkbookOfferDraft} from '../../domain/company-workbook';
import s from './AdminPanel.module.css';

type Company={companyId:string;name:string;status:string;version:number;urgent:number;offer:Offer};
type Send=(action:string,input:unknown,url?:string)=>Promise<Record<string,unknown>>;
const emptyCriteria:CarrierCriteria={source:'',sap:'unknown',trailers:[],excludedTrailers:[],trucks:[],routes:[],excludedStates:[],excludedCities:[],minimumOutDays:null,stateMinimumOutDays:{},minimumExperienceMonths:null,trailerExperienceMonths:{},review:[]};
const normalize=(name:string)=>name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function CompanyWorkbookImport({catalog,busy,send}:{catalog:Company[];busy:boolean;send:Send}){
 const [fileName,setFileName]=useState(''),[drafts,setDrafts]=useState<WorkbookOfferDraft[]>([]),[selected,setSelected]=useState<string[]>([]),[working,setWorking]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const names=useMemo(()=>new Set(catalog.map(company=>normalize(company.name))),[catalog]);
 const candidates=drafts.map(d=>({...d,existing:d.existing||names.has(normalize(d.name))}));
 const newDrafts=candidates.filter(d=>!d.existing),selectedNew=newDrafts.filter(d=>selected.includes(d.id));
 const readFile=async(file:File)=>{setError('');setMessage('');setDrafts([]);setSelected([]);setFileName(file.name);try{if(!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('Upload an .xlsx file. Older .xls workbooks are not supported.');const sheets=parseXlsx(await file.arrayBuffer());const parsed=buildWorkbookOfferDrafts(sheets,catalog.map(c=>c.name));if(!parsed.length)throw new Error('No company terms were detected. Use a workbook with a company on each worksheet or a table with a Company / Carrier column.');setDrafts(parsed);setSelected(parsed.filter(d=>!d.existing).map(d=>d.id));setMessage(`Read ${parsed.length} company entries across ${sheets.length} worksheets.`);}catch(e){setError(e instanceof Error?e.message:'Could not read this workbook.');}};
 const update=(id:string,patch:Partial<WorkbookOfferDraft>)=>setDrafts(prev=>prev.map(d=>d.id===id?{...d,...patch}:d));
 const toggle=(id:string,checked:boolean)=>setSelected(prev=>checked?[...new Set([...prev,id])]:prev.filter(item=>item!==id));
 const importSelected=async()=>{if(working||!selectedNew.length)return;setWorking(true);setError('');setMessage('');let created=0,failed=0;
  for(const draft of selectedNew){const source=`Excel import: ${fileName} · ${draft.sheet} · terms need verification.`;const criteria={...emptyCriteria,source,sap:draft.sap,review:['Review workbook terms and confirm current opening before recommending.']};const input={companyId:`company-${crypto.randomUUID()}`,offerId:`offer-${crypto.randomUUID()}`,expectedVersion:0,create:true,name:draft.name,status:'pending_review',source,program:draft.program,employment:draft.employment,requiredLicense:null,hiringStates:null,matchingCriteria:criteria,summary:draft.summary,schedule:draft.schedule,equipment:draft.equipment,deductions:[],payUnit:draft.payUnit,payMin:draft.payMin,payMax:draft.payMax,payBasis:'unknown',reviewed:false};
   try{await send('save_company_fields',input);created++;setSelected(prev=>prev.filter(id=>id!==draft.id));}catch(e){failed++;setError(e instanceof Error?e.message:`Could not add ${draft.name}.`);break;}
  }
  setWorking(false);if(created)setMessage(`${created} new ${created===1?'company was':'companies were'} added for review. Their offers are not active until an admin verifies and approves the terms.${failed?' The remaining import stopped at the first error.':''}`);
 };
 return <section aria-labelledby='company-workbook-heading' className={s.workbookImport}>
  <h3 id='company-workbook-heading'>Import companies from Excel</h3>
  <p>Upload an .xlsx file. The importer reads company names and terms from each worksheet (or from a table with a Company / Carrier column), compares names with the catalog, and marks new entries for review. Existing companies are never overwritten.</p>
  <label className={s.filePicker}>Excel workbook (.xlsx)<input type='file' accept='.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' disabled={busy||working} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void readFile(file);e.currentTarget.value='';}}/><small>Maximum 12 MB. Terms are extracted locally in this browser; no workbook is stored or sent elsewhere.</small></label>
  {error&&<p role='alert'>{error}</p>}{message&&<p role='status'>{message}</p>}
  {!!drafts.length&&<><p><strong>{fileName}</strong> · {candidates.length} detected · {newDrafts.length} new · {candidates.length-newDrafts.length} already in catalog</p><div className={s.workbookList}>{candidates.map(d=><article key={d.id} className={d.existing?s.workbookExisting:s.workbookNew}>
   <label className={s.workbookSelect}><input type='checkbox' checked={!d.existing&&selected.includes(d.id)} disabled={d.existing||busy||working} onChange={e=>toggle(d.id,e.target.checked)}/><strong>{d.name}</strong><span>{d.existing?'Already in catalog · left unchanged':'New · will be added for review'}</span></label>
   <small>Worksheet: {d.sheet} · Detected program: {d.program.replaceAll('_',' ')} · SAP: {d.sap.replaceAll('_',' ')}</small>
   <label>Terms found in worksheet<textarea value={d.summary} onChange={e=>update(d.id,{summary:e.target.value})} maxLength={8000}/></label>
   <details><summary>Detected schedule and equipment details</summary><label>Schedule / home time<textarea value={d.schedule} onChange={e=>update(d.id,{schedule:e.target.value})} maxLength={8000}/></label><label>Truck, trailer and duties<textarea value={d.equipment} onChange={e=>update(d.id,{equipment:e.target.value})} maxLength={8000}/></label></details>
  </article>)}</div><div className={s.actions}><button type='button' disabled={!newDrafts.length||busy||working} onClick={()=>setSelected(newDrafts.map(d=>d.id))}>Select all new</button><button type='button' disabled={busy||working} onClick={()=>setSelected([])}>Clear selection</button><button type='button' data-primary disabled={!selectedNew.length||busy||working} onClick={()=>void importSelected()}>{working?'Adding companies…':`Add ${selectedNew.length} selected for review`}</button></div><p>Imported offers stay inactive until an admin checks the terms, matching requirements and current hiring availability.</p></>}
 </section>;
}

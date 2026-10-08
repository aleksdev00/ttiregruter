'use client';
import {useState} from 'react';
import type {Conversation} from '../../contracts';
import {activeGuideQuestions,callGuideQuestions,callProgress,guideState,type AnswerStatus} from '../../domain/guide';
import {nextGuideStep} from '../../domain/guide';
import {GuideAnswer} from './GuideAnswer';
import s from '../workspace/Workspace.module.css';
type Props={conversation:Conversation;busy:boolean;onConfirm:(id:string,value:string,reason:string,status:AnswerStatus)=>Promise<boolean>;onIncident?:(note:string)=>Promise<boolean>;onDirty:(dirty:boolean)=>void};
function SavedAnswer({id,conversation,busy,onConfirm,onDirty}:Props&{id:string}){
 const g=guideState(conversation);
 return <GuideAnswer key={`${id}-${g.answers[id]??''}-${g.reviewReasons[id]??''}`} questionId={id} conversation={conversation} busy={busy} autosave onDirty={onDirty} onConfirm={(q,value,reason,status)=>void onConfirm(q,value,reason,status).then(saved=>{if(saved)onDirty(false);})}/>;
}
export function GroupedQualification(props:Props){
 const {conversation:c}=props,p=callProgress(c),questions=callGuideQuestions(c),q=questions.find(q=>q.id===p.next);
 return <div className={s.shortQualification}>{nextGuideStep(c)==='incidents'?<IncidentAnswer {...props}/>:q?<><p className={s.shortPrompt}>{q.spoken}</p><SavedAnswer {...props} id={q.id}/></>:<p>Quick call answers recorded. Discuss a company and request CDL front/back and medical.</p>}<details><summary>Review answers / additional details</summary><AdditionalDriverDetails {...props}/></details></div>;
}
export function AdditionalDriverDetails(props:Props){
 const {conversation:c,busy}=props,questions=activeGuideQuestions(c),[id,setId]=useState('state'),[dirty,setDirty]=useState(false),current=questions.some(q=>q.id===id)?id:questions[0]?.id;
 const onDirty=(value:boolean)=>{setDirty(value);props.onDirty(value);};
 return <div className={s.additionalDetails}><p>Confirm location before applying. Ask other preferences only when relevant to the company or raised by the driver.</p><label htmlFor="additional-driver-question">Detail to record or review</label><select id="additional-driver-question" value={current??''} disabled={busy||dirty} onChange={e=>setId(e.target.value)}>{questions.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select>{current&&<SavedAnswer {...props} id={current} onDirty={onDirty}/>}</div>;
}

function IncidentAnswer({busy,onIncident,onDirty}:Props){
 const [kind,setKind]=useState(''),[detail,setDetail]=useState(''),[error,setError]=useState('');
 return <div className={s.guideAnswer}><p>Any moving violations or accidents I need to account for?</p><label htmlFor="incident-kind">Driver-reported incident history (separate from SAP)</label><select id="incident-kind" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);onDirty(true);}}><option value="">Choose the actual response</option><option value="none">Driver reports none</option><option value="reported">Incident reported</option><option value="unknown">Unknown / needs verification</option></select>{kind&&kind!=='none'&&<><label htmlFor="incident-detail">{kind==='reported'?'Type and date; read corrected dates back':'Reason this needs verification'}</label><textarea id="incident-detail" maxLength={340} value={detail} onChange={e=>{setDetail(e.target.value);onDirty(true);}}/></>}<button disabled={busy||!kind} onClick={async()=>{if(kind!=='none'&&!detail.trim()){setError('Record the incident type and date, or a specific verification reason.');return;}const note=kind==='none'?'Driver reports no moving violations or accidents.':kind==='reported'?'Driver-reported incident (type/date): '+detail.trim():'Incident history unknown; verification reason: '+detail.trim();if(await onIncident?.(note)){onDirty(false);setError('');}}}>Confirm incident response</button>{error&&<small role="alert">{error}</small>}<small>Driver report only. The carrier must review eligibility. SAP is asked separately.</small></div>;
}

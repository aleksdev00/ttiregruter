'use client';
import {useState} from 'react';
import {sentencePages} from '../../domain/presentation';
import s from '../workspace/Workspace.module.css';
export function SegmentView({text,label}:{text:string;label:string}){const [page,setPage]=useState(0);const pages=sentencePages(text,360),current=Math.min(page,pages.length-1);return <div className={s.segmentView} aria-label={label}><p>{pages[current]}</p>{pages.length>1&&<div className={s.assistNav}><button disabled={current===0} onClick={()=>setPage(current-1)}>Previous</button><span>{current+1}/{pages.length}</span><button disabled={current===pages.length-1} onClick={()=>setPage(current+1)}>Next</button></div>}</div>;}

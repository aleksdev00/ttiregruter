'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
export function AddContactForm({accounts,className,onSaved}:{accounts?:{id:string;label:string}[];className?:string;onSaved:()=>Promise<void>}){
 const [saved,setSaved]=useState<{id:string;contact:{name:string;phone:string;status:string;ownerId:string;canOpen:boolean}}|null>(null);
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[note,setNote]=useState(''),[owner,setOwner]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);const locked=useRef(false);
 return <section><h2>Add contact</h2><p>Only a valid phone number is required. Contacts you add for yourself appear in My contacts. Contacts you assign to another recruiter appear in their Assigned contacts. No approval is needed.</p><form className={className} style={className?undefined:{display:'grid',gap:12,maxWidth:600}} onSubmit={async e=>{e.preventDefault();if(locked.current)return;locked.current=true;setBusy(true);setMessage('');setError(false);setSaved(null);try{
  const response=await fetch('/api/operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'create_driver',input:{name:name.trim(),phone:phone.trim(),email:email.trim(),nextAction:note.trim(),...(owner?{ownerId:owner}:{})}})});
  const result=await response.json() as {ok:boolean;message?:string;value?:{message?:string;id:string;contact:{name:string;phone:string;status:string;ownerId:string;canOpen:boolean}}};
  if(!response.ok||!result.ok)throw Error(result.message||'Contact was not saved. Check your entries and retry.');
  if(!result.value?.contact)throw Error('Saved record details were not returned. Retry with the same phone number.');setSaved(result.value);setMessage(result.value.message||'Contact saved and confirmed.');setName('');setPhone('');setEmail('');setNote('');
  try{await onSaved();}catch{setMessage((result.value?.message||'Contact saved.')+' Refresh the contact list to view the saved record.');}
 }catch(e){setError(true);setMessage(e instanceof Error?e.message:'Saving was not confirmed. Your entries are preserved. Retry with the same phone number.');}finally{locked.current=false;setBusy(false);}}}>
 <label>Name (optional)<input disabled={busy} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Phone<input disabled={busy} required type='tel' autoComplete='tel' value={phone} placeholder='(312) 555-0123' onChange={e=>setPhone(e.target.value)}/></label>
 <label>Email (optional)<input disabled={busy} type='email' value={email} onChange={e=>setEmail(e.target.value)}/></label>
 {accounts&&<label>Assign to recruiter<select disabled={busy} value={owner} onChange={e=>setOwner(e.target.value)}><option value=''>My account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select></label>}
 <label>Note / next action (optional)<input disabled={busy} maxLength={400} value={note} onChange={e=>setNote(e.target.value)}/></label>
 <div><button data-primary disabled={busy||!phone.trim()}>{busy?'Saving contact…':accounts?'Add contact':'Add to my contacts'}</button></div>
 </form>{message&&<p role={error?'alert':'status'}>{message}</p>}{saved&&<div><strong>{saved.contact.name}</strong><p>{saved.contact.phone} · {saved.contact.status.replaceAll('_',' ')} · Assigned to {accounts?.find(a=>a.id===saved.contact.ownerId)?.label||'your account'}</p>{saved.contact.canOpen&&<Link href={'/workspace/driver/'+encodeURIComponent(saved.id)}>Open this contact’s script</Link>}</div>}</section>;
}

'use client';
import {copyStoredPhone} from '../../domain/copy-phone';
import {useState} from 'react';
import type {Contact} from '../../contracts';
export function CopyPhone({contact}:{contact:Contact}){const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);const phone=contact.phoneRaw??contact.phoneNormalized;return <span style={{display:'inline-flex',flexDirection:'column',gap:4}}><button type="button" disabled={busy||!phone} onClick={async e=>{e.stopPropagation();setBusy(true);setMessage('');try{await copyStoredPhone(phone,navigator.clipboard);setMessage('Phone copied');}catch{setMessage('Copy failed. Select the number below and copy it manually.');}finally{setBusy(false);}}}>Copy phone</button>{message&&<small role="status">{message}</small>}{message.startsWith('Copy failed')&&<input aria-label="Phone to copy manually" readOnly value={phone??''} onFocus={e=>e.target.select()}/>}</span>;}

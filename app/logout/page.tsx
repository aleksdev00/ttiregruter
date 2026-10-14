'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function LogoutPage(){
 const router=useRouter(),[message,setMessage]=useState('Signing out…');
 useEffect(()=>{let active=true;void fetch('/api/auth/logout',{method:'POST',redirect:'error'}).then(async response=>{const result=await response.json() as {ok?:boolean};if(!response.ok||!result.ok)throw Error('Sign out was not confirmed. Reload and retry.');if(active){router.replace('/login');router.refresh();}}).catch(error=>{if(active)setMessage(error instanceof Error?error.message:'Sign out failed. Reload and retry.');});return()=>{active=false;};},[router]);
 return <main style={{padding:32}}><p role='status'>{message}</p></main>;
}

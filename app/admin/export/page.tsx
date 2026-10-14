import {ExportControls} from './ExportControls';
import Link from 'next/link';
import {env} from '@/src/server/platform';
import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {requireExportIdentity} from '@/src/server/export/database';
export const dynamic='force-dynamic';
export default async function ExportPage(){
 const user=await requireChatGPTUser('/admin/export');
 const record=env.DB?await env.DB.prepare('SELECT email,role,active,user_id FROM recruiters WHERE user_id=? AND lower(email)=?').bind(user.userId,user.email.toLowerCase()).first<{email:string;role:string;active:number;user_id:string|null}>():null;
 try{requireExportIdentity(user,record);}catch{return <main style={{padding:32}}><h1>Export access restricted</h1><Link href='/'>Return to workspace</Link></main>;}
 return <main style={{padding:32,maxWidth:820,margin:'0 auto',lineHeight:1.6}}>
 <Link href='/admin'>Back to admin panel</Link><h1>Complete migration export</h1>
 <p>Available only to Alex Jones’s verified administrator account. Exports copy data into protected temporary snapshot tables. They do not submit applications, send messages or change contact assignments.</p>
 <h2>1. Database → Supabase SQL</h2><p>Captures all 31 source tables in one D1 transaction, then downloads small verified chunks with the prepared PostgreSQL schema and row-count checks. Use a new, empty Supabase database. Historical login codes and transient processing locks are cleared; recruiter identities, assignments, application history and contact restrictions are preserved.</p>
 <ExportControls/>
 <p>Keep the downloaded file private. The browser assembles the SQL only after all chunks and counts are verified. A failed request can be retried against the same snapshot. Snapshot access expires after 24 hours; use Remove temporary snapshot after saving your file. Confirm the file ends with “END OF COMPLETE DATABASE EXPORT” before importing.</p>
 <h2>2. Documents and stored files</h2><p>Downloads all listed R2 objects as a ZIP, preserving their original keys and adding an object manifest. If an object changes during download, the archive fails and must be retried. Wait for the SQL download to finish before starting this archive.</p>
 <p><a href='/api/admin-export?kind=files' download>Download complete R2 file archive</a></p>
 <h2>3. Before the Vercel cutover</h2><p>These downloads transfer data. The current application still uses Cloudflare D1/R2 and ChatGPT authentication. Its server routes must be connected to Supabase Database, Auth and Storage before a working Vercel launch. Auth users are created separately; passwords and active sessions are not copied.</p>
 <p>Other recruiters can keep working during export. A final synchronized export or delta transfer is required at cutover to include subsequent edits. Database and file archives are separate snapshots.</p>
 </main>;
}

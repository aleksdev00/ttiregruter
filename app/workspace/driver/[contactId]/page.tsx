import {decodePageId} from '@/src/domain/route-id';
import {requirePrivateUser} from '@/src/server/private-auth';
import {Workspace} from '@/src/features/workspace/Workspace';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{contactId:string}>}){const {contactId}=await params;return <ProtectedWorkspace id={decodePageId(contactId)}/>;}
async function ProtectedWorkspace({id}:{id:string}){await requirePrivateUser(`/workspace/driver/${encodeURIComponent(id)}`);return <Workspace id={id} contactId={id}/>;}

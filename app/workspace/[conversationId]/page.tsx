import {decodePageId} from '@/src/domain/route-id';
import {requirePrivateUser} from '@/src/server/private-auth';
import {Workspace} from '@/src/features/workspace/Workspace';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{conversationId:string}>}){const {conversationId}=await params;return <ProtectedWorkspace id={decodePageId(conversationId)}/>;}
async function ProtectedWorkspace({id}:{id:string}){await requirePrivateUser(`/workspace/${encodeURIComponent(id)}`);return <Workspace id={id}/>;}

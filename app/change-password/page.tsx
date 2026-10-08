import {requirePrivateUser} from '@/src/server/private-auth';
import {ChangePasswordForm} from '@/src/features/ChangePasswordForm';
export const dynamic='force-dynamic';
export default async function ChangePasswordPage({searchParams}:{searchParams:Promise<{return_to?:string}>}){const user=await requirePrivateUser('/change-password',true),params=await searchParams,returnTo=params.return_to&&params.return_to.startsWith('/')&&!params.return_to.startsWith('//')?params.return_to:'/';return <ChangePasswordForm mustChange={user.mustChangePassword} returnTo={returnTo}/>;}

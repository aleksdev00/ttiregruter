import {safeReturnPath} from '@/src/server/security-policy';
import {redirect} from 'next/navigation';
import {getPrivateUser} from '@/src/server/private-auth';
import {LoginForm} from '@/src/features/LoginForm';
export const dynamic='force-dynamic';
export default async function LoginPage({searchParams}:{searchParams:Promise<{return_to?:string}>}){const user=await getPrivateUser(),p=await searchParams,returnTo=safeReturnPath(p.return_to);if(user)redirect(user.mustChangePassword?'/change-password?return_to='+encodeURIComponent(returnTo):returnTo);return <LoginForm returnTo={returnTo}/>;}

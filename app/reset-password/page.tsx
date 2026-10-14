import {redirect} from 'next/navigation';import {hasRecoverySession} from '@/src/server/private-auth';import {ResetPasswordForm} from '@/src/features/ResetPasswordForm';
export const dynamic='force-dynamic';
export default async function ResetPage(){if(!await hasRecoverySession())redirect('/login?recovery=expired');return <ResetPasswordForm/>;}

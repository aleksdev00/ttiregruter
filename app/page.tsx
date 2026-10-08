import {requirePrivateUser} from '@/src/server/private-auth';
import { Dashboard } from '@/src/features/dashboard/Dashboard';
export const dynamic='force-dynamic';
export default async function Page(){await requirePrivateUser('/');return <Dashboard/>;}

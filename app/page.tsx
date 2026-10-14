import {requireChatGPTUser} from '@/app/chatgpt-auth';
import { Dashboard } from '@/src/features/dashboard/Dashboard';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/');return <Dashboard/>;}

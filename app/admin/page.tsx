import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {AdminPanel} from '@/src/features/admin/AdminPanel';
export const dynamic='force-dynamic';
// Use the shared provider for account and daily-session loading, as on Page 1.
// All admin reads and writes remain independently authorized in /api/admin.
export default async function AdminPage(){await requireChatGPTUser('/admin');return <AdminPanel/>;}

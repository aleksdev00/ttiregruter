// Legacy workflow import names retained; Vercel uses approved server-owned Supabase sessions.
import {getPrivateUser,requirePrivateUser} from '@/src/server/private-auth';
import {safeReturnPath} from '@/src/server/security-policy';
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{const user=await getPrivateUser();return user&&!user.mustChangePassword?{userId:user.userId,displayName:user.displayName,email:user.email,fullName:user.fullName}:null;}
export async function requireChatGPTUser(returnTo:string){return requirePrivateUser(returnTo);}
export function chatGPTSignInPath(returnTo:string){return '/login?return_to='+encodeURIComponent(safeReturnPath(returnTo));}
export function chatGPTSignOutPath(){return '/logout';}

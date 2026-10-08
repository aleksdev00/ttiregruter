import {runtime,failure,json,checkOrigin} from '@/src/server/runtime';
import {conversationHistory,editHistoricalNotes} from '@/src/server/historical-notes';
export async function GET(request:Request){try{const {db,actor}=await runtime(false);return json({ok:true,value:await conversationHistory(db,actor,new URL(request.url).searchParams.get('conversationId')??'')});}catch(e){return failure(e);}}
export async function POST(request:Request){try{checkOrigin(request);const {db,actor}=await runtime(false);return json({ok:true,value:await editHistoricalNotes(db,actor,await request.json())});}catch(e){return failure(e);}}

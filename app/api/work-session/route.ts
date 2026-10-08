import {runtime,failure,json} from '@/src/server/runtime';
export const dynamic='force-dynamic';
export async function GET(){try{const {actor}=await runtime(false);return json({ok:true,value:{profile:actor.profile,session:{status:'active',privateTest:true}}});}catch(e){return failure(e);}}
export async function POST(){return Response.json({ok:false,message:'The private test uses owner-only Site sign-in. No shift code or email is sent.'},{status:403});}

import {runtime,failure,json} from '@/src/server/runtime';
export const dynamic='force-dynamic';
export async function GET(){try{const {actor}=await runtime(false);return json({ok:true,value:{profile:actor.profile,session:{status:'active'}}});}catch(e){return failure(e);}}
export async function POST(){return Response.json({ok:false,message:'Sign in with your approved email and password. Daily shift codes are no longer required.'},{status:405,headers:{allow:'GET'}});}

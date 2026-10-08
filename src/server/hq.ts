import {ServiceError} from './access.ts';
import {z} from 'zod';
import {referralReadiness} from '../domain/playbook.ts';
import type {Contact,DriverAnswers,Offer,Recruiter} from '../contracts/index.ts';
import type {GuideState} from '../domain/guide.ts';
export type HQProtocol='legacy'|'mapped_bridge';
export interface HQSettings {url?:string;secret?:string;protocol?:HQProtocol}
export function verifiedHQUrl(raw?:string){
 let url:URL;try{url=new URL(raw??'');}catch{throw new ServiceError('HQ_WEBHOOK_URL is missing or invalid.',503,'not_configured');}
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[^/]+\/exec$/.test(url.pathname)||url.search||url.hash)throw new ServiceError('Use the Apps Script deployed /exec URL in HQ_WEBHOOK_URL.',503,'not_configured');
 return url.href;
}
// These probes have no driver or application IDs and no business data. Both
// supported handlers reject them before spreadsheet writes or notifications.
export async function checkHQConnection(config:HQSettings,send:typeof fetch=fetch){
 const url=verifiedHQUrl(config.url);if(!config.secret)throw new ServiceError('HQ_WEBHOOK_SECRET is missing.',503,'not_configured');
 const probe=async(secret:string)=>{
  const response=await send(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'ttiConnectionCheck',secret,webhookSecret:secret}),signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw new ServiceError('Apps Script is unavailable or requires Google sign-in. Check deployment access.',502,'not_configured');
  try{return await response.json() as {ok?:boolean;error?:string};}catch{throw new ServiceError('Apps Script returned a page instead of JSON. Verify the /exec deployment and access.',502,'not_configured');}
 };
 try{
  const rejected=await probe('tti-invalid-'+crypto.randomUUID());
  if(rejected.ok||rejected.error!=='Unauthorized.')return {connected:false,protocol:null,message:'The endpoint did not reject an invalid key as expected. Transfer remains unverified.'};
  const accepted=await probe(config.secret);
  if(accepted.error==='Unauthorized.')return {connected:false,protocol:null,message:'The URL responds, but HQ_WEBHOOK_SECRET does not match the Apps Script WEBHOOK_SECRET.'};
  if(accepted.error==='Unsupported action.')return {connected:true,protocol:'legacy' as const,message:'HQ URL and secret verified. Legacy TTI protocol detected. No spreadsheet records or emails were created. A completed application transfer still needs verification.'};
  if(['Stable application and driver IDs required.','Transfer not activated.','Mapping must be verified before writing.'].includes(accepted.error??''))return {connected:true,protocol:'mapped_bridge' as const,message:'HQ URL and secret verified. Mapped bridge detected. No records or emails were created. Bridge activation and spreadsheet mapping still need verification.'};
  return {connected:false,protocol:null,message:'The endpoint answered with an unrecognized contract. Transfer remains unverified.'};
 }catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError('HQ connection timed out or could not be reached. No application was sent.',502,'not_configured');}
}
interface ApplicationSnapshot {driver:Contact;recruiter:Recruiter&{userId?:string};terms:Offer;answers:DriverAnswers;guide?:GuideState;notes?:Record<string,unknown>;agreement:boolean;createdAt:string|number}
const legacySubmissionSchema=z.object({idempotencyKey:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/),completedAtUtc:z.string().datetime(),recruiter:z.object({id:z.string().min(1),name:z.string().min(1),email:z.string().email()}),driver:z.object({id:z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/),phone:z.string().regex(/^\+\d{10,15}$/),consentConfirmed:z.literal(true)}),finalCompany:z.object({name:z.string().min(1),offerId:z.string().min(1)})});
export function legacyHQPayload(applicationId:string,driverId:string,data:ApplicationSnapshot,secret:string){
 const g=data.guide;const answer=(field:string)=>g?.confirmed[field]&&!g.reviewReasons[field]?g.answers[field]??'':'';
 const payload={action:'completeApplication',webhookSecret:secret,idempotencyKey:applicationId,completedAtUtc:new Date(data.createdAt).toISOString(),
  recruiter:{id:data.recruiter.id,userId:data.recruiter.userId,name:data.recruiter.fullName,alias:data.recruiter.alias,email:data.recruiter.contactEmail??'',referralLink:referralReadiness(data.recruiter).ready?data.recruiter.referralUrl??'':''},
  driver:{id:driverId,firstName:data.driver.firstName??'',lastName:data.driver.lastName??'',phone:data.driver.phoneNormalized??'',email:data.driver.email??'',state:answer('state'),zipCode:answer('locationZip').split(' | ')[1]??'',cdl:data.answers.licenseClass==='unknown'?'':data.answers.licenseClass,experienceMonths:answer('experienceMonths')?Number(answer('experienceMonths')):null,sapStatus:answer('sap'),equipmentPreference:answer('trailer'),truckPreference:answer('truck'),desiredPosition:answer('position'),employmentTypePreference:answer('employmentType'),routePreference:answer('route'),homeTime:answer('home'),payTarget:answer('payTarget'),startAvailability:answer('availability'),mainPriority:answer('priority'),dealbreakers:answer('dealbreakers'),consentConfirmed:data.agreement===true},
  finalCompany:{id:data.terms.sourceRowId??data.terms.id,name:data.terms.companyName,offerId:data.terms.id,employmentType:data.terms.employment==='w2'?'W-2':data.terms.employment,position:answer('position'),pay:data.terms.pay.note,termsVersion:data.terms.snapshotVersion}};
 Object.assign(payload.driver,{locationZip:answer('locationZip'),source:data.driver.sourceLabel??'',notes:Object.entries(data.notes??{}).filter(([,v])=>typeof v==='string'&&v).map(([key,value])=>`${key}: ${value}`).join('\n')});
 if(!legacySubmissionSchema.safeParse(payload).success)throw new ServiceError('Application cannot be sent: confirm driver phone, explicit agreement, one company and verified recruiter identity. The saved application remains available.',400,'invalid_input');
 return payload;
}

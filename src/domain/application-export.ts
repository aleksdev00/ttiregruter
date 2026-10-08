import type {Contact,Conversation,Recruiter} from '../contracts/index.ts';

export const ONLINE_APPS_HEADERS = [
  'Application ID','Submitted At','Status','First Name','Last Name','Phone','Email','ZIP Code','State','Date of Birth','Street Address','City','County','Previous Address','CDL Status','CDL Class','CDL State','CDL Number','CDL Expiration','Endorsements','Restrictions','Total Driving Experience','Experience Summary','Equipment','OTR Experience','Max Weeks Out','Employer 1 Company','Employer 1 Phone','Employer 1 Position','Employer 1 Supervisor/Safety Contact','Employer 1 Start Date','Employer 1 End Date','Employer 1 CMV','Employer 1 DOT Safety-Sensitive','Employer 2 Company','Employer 2 Phone','Employer 2 Position','Employer 2 Supervisor/Safety Contact','Employer 2 Start Date','Employer 2 End Date','Employer 2 CMV','Employer 2 DOT Safety-Sensitive','Accidents','Accident Details','Violations','Violation Details','DUI/DWI','DUI/DWI Details','Drug/Alcohol/SAP','SAP Details','Medical Card Valid','Medical Expiration','Operation Preference','Preferred Freight','Minimum CPM','Preferred Truck','Pet','Passenger','MVR Consent','PSP Consent','Employment Verification Consent','Application Certification','Signature Name','Signature Date','Signature','CDL Front Document','CDL Back Document','Medical Card Document','SAP Document','Recruiter Code','Notes',
] as const;

export type OnlineAppsHeader = typeof ONLINE_APPS_HEADERS[number];
export type OnlineAppsRow = Record<OnlineAppsHeader,string>;
const safe=(v:unknown)=>v===null||v===undefined?'':String(v);
const text=(v:unknown)=>safe(v).replace(/[\t\r\n]+/g,' ').trim();

export interface ExportInput { applicationId:string; submittedAt:string; status:string; contact:Contact; conversation:Conversation; recruiter:Recruiter; recruiterCode?:string|null; originalNotes?:unknown; attribution?:Record<string,unknown>; }

export function buildOnlineAppsRow(input:ExportInput):OnlineAppsRow {
  const {contact:c,conversation:conv,recruiter:r}=input;
  const q=conv.answers;
  const row=Object.fromEntries(ONLINE_APPS_HEADERS.map(h=>[h,''])) as OnlineAppsRow;
  Object.assign(row,{
    'Application ID':text(input.applicationId),'Submitted At':text(input.submittedAt),'Status':text(input.status),
    'First Name':text(c.firstName),'Last Name':text(c.lastName),'Phone':text(c.phoneRaw??c.phoneNormalized),'Email':text(c.email),
    'State':text(c.state??q.homeState),'City':text(c.city),'CDL Status':q.licenseClass==='unknown'?'':q.licenseClass?'confirmed':'',
    'CDL Class':text(q.licenseClass==='unknown'?'':q.licenseClass),'Total Driving Experience':q.experienceMonths===null?'':text(q.experienceMonths),
    'Operation Preference':text(q.employment),'Preferred Freight':text(q.routePreference),'Max Weeks Out':text(q.homeTimePreference),
    'Preferred Truck':text(c.rawFields.truck),'Equipment':text(c.rawFields.equipment),'Minimum CPM':text(c.rawFields.minimumCpm),
    'Recruiter Code':text(input.recruiterCode),
    'Notes':JSON.stringify({...((input.originalNotes&&typeof input.originalNotes==='object')?input.originalNotes:{}),_ttiAttribution:{schemaVersion:1,canonicalApplicationId:input.applicationId,applicationSource:'tti_recruiter',recruiterId:r.id,recruiterFullName:r.fullName,...input.attribution??{}}}),
  });
  return row;
}

export function rowToOrderedValues(row:OnlineAppsRow):string[]{return ONLINE_APPS_HEADERS.map(header=>text(row[header]));}

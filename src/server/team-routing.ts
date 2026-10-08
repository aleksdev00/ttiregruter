import type {Contact,Conversation,Recruiter} from '../contracts/index.ts';
import {ServiceError,type Actor,isAdmin} from './access.ts';
import {buildOnlineAppsRow,rowToOrderedValues} from '../domain/application-export.ts';

type MembershipRow={recruiter_id:string;team_id:string;active:number;full_name_from_quo:string;quo_user_id:string|null;effective_from:number;effective_to:number|null;display_name:string;owner_id:string|null;owner_name:string|null;destination_spreadsheet_id:string|null;configuration_version:number};

export async function teamTablesAvailable(db:D1Database){const row=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='teams'").first<{name:string}>();return !!row;}

export async function activeTeamForRecruiter(db:D1Database,recruiterId:string,at=Date.now()):Promise<MembershipRow|null>{
  return await db.prepare(`SELECT m.*,t.display_name,t.owner_id,t.owner_name,t.destination_spreadsheet_id,t.configuration_version FROM team_memberships m JOIN teams t ON t.id=m.team_id WHERE m.recruiter_id=? AND m.active=1 AND t.status='active' AND m.effective_from<=? AND (m.effective_to IS NULL OR m.effective_to>?)`).bind(recruiterId,at,at).first<MembershipRow>()??null;
}

export async function resolveTeamReferral(db:D1Database,code:string){
  return await db.prepare(`SELECT r.id,r.code,r.team_id,r.recruiter_id,r.configuration_version,t.display_name,t.owner_id,t.owner_name,t.destination_spreadsheet_id,t.status FROM team_referrals r JOIN teams t ON t.id=r.team_id WHERE r.code=? AND r.active=1`).bind(code).first<{id:string;code:string;team_id:string;recruiter_id:string|null;configuration_version:number;display_name:string;owner_id:string|null;owner_name:string|null;destination_spreadsheet_id:string|null;status:string}>();
}

export async function buildInternalAttribution(db:D1Database,actor:Actor,applicationId:string,contact:Contact,conversation:Conversation,recruiter:Recruiter,submittedAt:number){
  if(!(await teamTablesAvailable(db)))return null;
  const membership=await activeTeamForRecruiter(db,actor.id,submittedAt);
  const status=membership?(membership.destination_spreadsheet_id?'ready':'needs_review'):'needs_review';
  const attribution={schemaVersion:1,canonicalApplicationId:applicationId,applicationSource:'tti_recruiter',teamId:membership?.team_id??null,teamName:membership?.display_name??null,teamOwnerId:membership?.owner_id??null,teamOwnerName:membership?.owner_name??null,recruiterId:actor.id,recruiterFullName:membership?.full_name_from_quo??recruiter.fullName,attributionMethod:membership?'authenticated_active_team':'missing_active_team',configurationVersion:membership?.configuration_version??0};
  const row=buildOnlineAppsRow({applicationId,submittedAt:new Date(submittedAt).toISOString(),status:'Submitted',contact,conversation,recruiter,attribution});
  const tabName=membership?.full_name_from_quo||'Unassigned';
  return {membership,attribution,row,values:rowToOrderedValues(row),tabName,status};
}

export function attributionStatements(db:D1Database,applicationId:string,info:NonNullable<Awaited<ReturnType<typeof buildInternalAttribution>>>,now:number){
  const m=info.membership;
  return [
    db.prepare(`INSERT OR REPLACE INTO application_attributions(application_id,source,source_submission_id,team_id,team_name,team_owner_id,team_owner_name,team_referral_code,original_recruiter_referral_code,recruiter_id,recruiter_full_name,attribution_status,attribution_method,configuration_version,attributed_at,submitted_at,data_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(applicationId,'tti_recruiter',applicationId,m?.team_id??null,m?.display_name??null,m?.owner_id??null,m?.owner_name??null,null,null,info.attribution.recruiterId,info.attribution.recruiterFullName,info.status,info.attribution.attributionMethod,info.attribution.configurationVersion,now,now,JSON.stringify(info.attribution)),
    db.prepare(`INSERT OR REPLACE INTO export_deliveries(id,application_id,version,team_id,destination_spreadsheet_id,destination_sheet_id,destination_tab_name,status,attempts,last_error,row_identity,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,0,NULL,?,?,?)`).bind('export:'+applicationId,applicationId,1,m?.team_id??null,m?.destination_spreadsheet_id??null,null,info.tabName,m?.destination_spreadsheet_id?'queued':'needs_review',applicationId,now,now),
  ];
}

export async function persistInternalRouting(db:D1Database,actor:Actor,applicationId:string){
  if(!(await teamTablesAvailable(db)))return null;
  const prior=await db.prepare('SELECT application_id FROM application_attributions WHERE application_id=?').bind(applicationId).first<{application_id:string}>();
  if(prior)return await db.prepare('SELECT status FROM export_deliveries WHERE application_id=? ORDER BY version DESC LIMIT 1').bind(applicationId).first<{status:string}>();
  const row=await db.prepare(`SELECT a.data_json AS app_json,c.data_json AS conversation_json,d.data_json AS driver_json,r.data_json AS recruiter_json FROM applications a JOIN conversations c ON c.id=a.conversation_id JOIN drivers d ON d.id=a.driver_id JOIN recruiters r ON r.id=c.recruiter_id WHERE a.id=?`).bind(applicationId).first<{app_json:string;conversation_json:string;driver_json:string;recruiter_json:string}>();
  if(!row)return null;
  const contact=JSON.parse(row.driver_json) as Contact; const conversation=JSON.parse(row.conversation_json) as Conversation; const recruiter=JSON.parse(row.recruiter_json) as Recruiter;
  const createdAt=JSON.parse(row.app_json).createdAt;const submittedAt=typeof createdAt==='number'?createdAt:Date.parse(createdAt);if(!Number.isFinite(submittedAt))throw new ServiceError('Saved application timestamp needs review.');
  const info=await buildInternalAttribution(db,actor,applicationId,contact,conversation,recruiter,submittedAt); if(!info)return null;
  await db.batch(attributionStatements(db,applicationId,info,Date.now()));
  return {status:info.status};
}

export function teamAdminRequired(a:Actor){if(!isAdmin(a))throw new ServiceError('Team configuration requires administrator access.',403,'not_allowed');}

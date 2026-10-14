-- Read-only verification of the 2026-10-13 TTI business snapshot. No contacts or credentials included.
-- After normal app writes begin, row counts can legitimately differ from this snapshot.
BEGIN READ ONLY;
SET LOCAL statement_timeout='60s';
SELECT * FROM (
SELECT 'account_setup_backups' AS table_name, count(*) AS actual_rows, 1::bigint AS snapshot_rows, count(*)=1 AS matches_snapshot FROM public."account_setup_backups"
UNION ALL
SELECT 'application_attributions' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."application_attributions"
UNION ALL
SELECT 'applications' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."applications"
UNION ALL
SELECT 'assignment_requests' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."assignment_requests"
UNION ALL
SELECT 'audit' AS table_name, count(*) AS actual_rows, 2915::bigint AS snapshot_rows, count(*)=2915 AS matches_snapshot FROM public."audit"
UNION ALL
SELECT 'companies' AS table_name, count(*) AS actual_rows, 31::bigint AS snapshot_rows, count(*)=31 AS matches_snapshot FROM public."companies"
UNION ALL
SELECT 'completion_notifications' AS table_name, count(*) AS actual_rows, 175::bigint AS snapshot_rows, count(*)=175 AS matches_snapshot FROM public."completion_notifications"
UNION ALL
SELECT 'conversations' AS table_name, count(*) AS actual_rows, 223::bigint AS snapshot_rows, count(*)=223 AS matches_snapshot FROM public."conversations"
UNION ALL
SELECT 'documents' AS table_name, count(*) AS actual_rows, 2::bigint AS snapshot_rows, count(*)=2 AS matches_snapshot FROM public."documents"
UNION ALL
SELECT 'drivers' AS table_name, count(*) AS actual_rows, 41003::bigint AS snapshot_rows, count(*)=41003 AS matches_snapshot FROM public."drivers"
UNION ALL
SELECT 'export_deliveries' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."export_deliveries"
UNION ALL
SELECT 'external_receipts' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."external_receipts"
UNION ALL
SELECT 'financial_transactions' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."financial_transactions"
UNION ALL
SELECT 'integration_attempts' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."integration_attempts"
UNION ALL
SELECT 'linked_messages' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."linked_messages"
UNION ALL
SELECT 'mutation_guards' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."mutation_guards"
UNION ALL
SELECT 'mutation_receipts' AS table_name, count(*) AS actual_rows, 2444::bigint AS snapshot_rows, count(*)=2444 AS matches_snapshot FROM public."mutation_receipts"
UNION ALL
SELECT 'offers' AS table_name, count(*) AS actual_rows, 46::bigint AS snapshot_rows, count(*)=46 AS matches_snapshot FROM public."offers"
UNION ALL
SELECT 'quo_events' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."quo_events"
UNION ALL
SELECT 'quo_line_allocations' AS table_name, count(*) AS actual_rows, 4500::bigint AS snapshot_rows, count(*)=4500 AS matches_snapshot FROM public."quo_line_allocations"
UNION ALL
SELECT 'quo_line_profiles' AS table_name, count(*) AS actual_rows, 14::bigint AS snapshot_rows, count(*)=14 AS matches_snapshot FROM public."quo_line_profiles"
UNION ALL
SELECT 'quo_mappings' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."quo_mappings"
UNION ALL
SELECT 'recruiter_contact_refill' AS table_name, count(*) AS actual_rows, 13::bigint AS snapshot_rows, count(*)=13 AS matches_snapshot FROM public."recruiter_contact_refill"
UNION ALL
SELECT 'recruiter_contact_refill_backups' AS table_name, count(*) AS actual_rows, 6002::bigint AS snapshot_rows, count(*)=6002 AS matches_snapshot FROM public."recruiter_contact_refill_backups"
UNION ALL
SELECT 'recruiters' AS table_name, count(*) AS actual_rows, 17::bigint AS snapshot_rows, count(*)=17 AS matches_snapshot FROM public."recruiters"
UNION ALL
SELECT 'store_revision' AS table_name, count(*) AS actual_rows, 1::bigint AS snapshot_rows, count(*)=1 AS matches_snapshot FROM public."store_revision"
UNION ALL
SELECT 'tasks' AS table_name, count(*) AS actual_rows, 24::bigint AS snapshot_rows, count(*)=24 AS matches_snapshot FROM public."tasks"
UNION ALL
SELECT 'team_memberships' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."team_memberships"
UNION ALL
SELECT 'team_referrals' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."team_referrals"
UNION ALL
SELECT 'teams' AS table_name, count(*) AS actual_rows, 0::bigint AS snapshot_rows, count(*)=0 AS matches_snapshot FROM public."teams"
UNION ALL
SELECT 'work_sessions' AS table_name, count(*) AS actual_rows, 59::bigint AS snapshot_rows, count(*)=59 AS matches_snapshot FROM public."work_sessions"
) counts ORDER BY table_name;
SELECT required.table_name,required.column_name,required.expected_type,c.data_type AS actual_type
FROM (VALUES ('account_setup_backups','id','text'),('account_setup_backups','created_at','bigint'),('account_setup_backups','data_json','text'),('application_attributions','application_id','text'),('application_attributions','source','text'),('application_attributions','source_submission_id','text'),('application_attributions','team_id','text'),('application_attributions','team_name','text'),('application_attributions','team_owner_id','text'),('application_attributions','team_owner_name','text'),('application_attributions','team_referral_code','text'),('application_attributions','original_recruiter_referral_code','text'),('application_attributions','recruiter_id','text'),('application_attributions','recruiter_full_name','text'),('application_attributions','attribution_status','text'),('application_attributions','attribution_method','text'),('application_attributions','configuration_version','bigint'),('application_attributions','attributed_at','bigint'),('application_attributions','submitted_at','bigint'),('application_attributions','data_json','text'),('applications','id','text'),('applications','driver_id','text'),('applications','conversation_id','text'),('applications','offer_id','text'),('applications','terms_version','text'),('applications','stage','text'),('applications','hq','text'),('applications','crm','text'),('applications','notification','text'),('applications','lease_token','text'),('applications','lease_at','bigint'),('applications','data_json','text'),('assignment_requests','id','text'),('assignment_requests','actor_id','text'),('assignment_requests','phone','text'),('assignment_requests','reason','text'),('assignment_requests','status','text'),('audit','id','text'),('audit','actor_id','text'),('audit','driver_id','text'),('audit','type','text'),('audit','at','bigint'),('audit','data_json','text'),('companies','id','text'),('companies','name','text'),('companies','status','text'),('companies','version','bigint'),('companies','data_json','text'),('completion_notifications','id','text'),('completion_notifications','conversation_id','text'),('completion_notifications','payload_json','text'),('completion_notifications','status','text'),('completion_notifications','lease_token','text'),('completion_notifications','lease_at','bigint'),('completion_notifications','message','text'),('completion_notifications','updated_at','bigint'),('conversations','id','text'),('conversations','driver_id','text'),('conversations','recruiter_id','text'),('conversations','status','text'),('conversations','data_json','text'),('documents','id','text'),('documents','driver_id','text'),('documents','kind','text'),('documents','filename','text'),('documents','mime','text'),('documents','size','bigint'),('documents','object_key','text'),('documents','actor_id','text'),('documents','created_at','bigint'),('drivers','id','text'),('drivers','owner_id','text'),('drivers','phone','text'),('drivers','blocked','bigint'),('drivers','duplicate','bigint'),('drivers','batch_id','text'),('drivers','next_action','text'),('drivers','data_json','text'),('export_deliveries','id','text'),('export_deliveries','application_id','text'),('export_deliveries','version','bigint'),('export_deliveries','team_id','text'),('export_deliveries','destination_spreadsheet_id','text'),('export_deliveries','destination_sheet_id','text'),('export_deliveries','destination_tab_name','text'),('export_deliveries','status','text'),('export_deliveries','attempts','bigint'),('export_deliveries','last_error','text'),('export_deliveries','row_identity','text'),('export_deliveries','created_at','bigint'),('export_deliveries','updated_at','bigint'),('external_receipts','id','text'),('external_receipts','conversation_id','text'),('external_receipts','driver_id','text'),('external_receipts','received_at','bigint'),('external_receipts','actor_id','text'),('external_receipts','source','text'),('external_receipts','evidence','text'),('financial_transactions','id','text'),('financial_transactions','application_id','text'),('financial_transactions','kind','text'),('financial_transactions','amount_cents','bigint'),('financial_transactions','occurred_at','bigint'),('financial_transactions','actor_id','text'),('financial_transactions','evidence','text'),('integration_attempts','id','text'),('integration_attempts','application_id','text'),('integration_attempts','at','bigint'),('integration_attempts','data_json','text'),('linked_messages','id','text'),('linked_messages','driver_id','text'),('linked_messages','company_id','text'),('linked_messages','channel','text'),('linked_messages','status','text'),('linked_messages','data_json','text'),('mutation_guards','id','text'),('mutation_guards','ok','bigint'),('mutation_receipts','id','text'),('mutation_receipts','actor_id','text'),('mutation_receipts','fingerprint','text'),('mutation_receipts','data_json','text'),('offers','id','text'),('offers','company_id','text'),('offers','version','text'),('offers','data_json','text'),('quo_events','id','text'),('quo_events','resource_id','text'),('quo_events','occurred_at','bigint'),('quo_events','driver_id','text'),('quo_events','recruiter_id','text'),('quo_events','status','text'),('quo_events','data_json','text'),('quo_line_allocations','driver_id','text'),('quo_line_allocations','line_id','text'),('quo_line_allocations','batch_id','text'),('quo_line_allocations','allocated_at','bigint'),('quo_line_profiles','id','text'),('quo_line_profiles','display_name','text'),('quo_line_profiles','phone','text'),('quo_line_profiles','recruiter_id','text'),('quo_line_profiles','created_at','bigint'),('quo_line_profiles','updated_at','bigint'),('quo_mappings','id','text'),('quo_mappings','recruiter_id','text'),('quo_mappings','verified_at','bigint'),('quo_mappings','actor_id','text'),('recruiter_contact_refill','run_id','text'),('recruiter_contact_refill','recruiter_id','text'),('recruiter_contact_refill','email','text'),('recruiter_contact_refill','target','bigint'),('recruiter_contact_refill','available_before','bigint'),('recruiter_contact_refill','needed','bigint'),('recruiter_contact_refill','eligible_pool','bigint'),('recruiter_contact_refill','assigned','bigint'),('recruiter_contact_refill','available_after','bigint'),('recruiter_contact_refill','status','text'),('recruiter_contact_refill','created_at','bigint'),('recruiter_contact_refill_backups','run_id','text'),('recruiter_contact_refill_backups','driver_id','text'),('recruiter_contact_refill_backups','recruiter_id','text'),('recruiter_contact_refill_backups','before_json','text'),('recruiter_contact_refill_backups','before_next_action','text'),('recruiter_contact_refill_backups','applied','bigint'),('recruiters','id','text'),('recruiters','user_id','text'),('recruiters','email','text'),('recruiters','role','text'),('recruiters','active','bigint'),('recruiters','data_json','text'),('store_revision','id','bigint'),('store_revision','value','bigint'),('tasks','id','text'),('tasks','driver_id','text'),('tasks','owner_id','text'),('tasks','kind','text'),('tasks','due_at','bigint'),('tasks','status','text'),('tasks','data_json','text'),('team_memberships','recruiter_id','text'),('team_memberships','team_id','text'),('team_memberships','active','bigint'),('team_memberships','effective_from','bigint'),('team_memberships','effective_to','bigint'),('team_memberships','full_name_from_quo','text'),('team_memberships','quo_user_id','text'),('team_memberships','updated_at','bigint'),('team_referrals','id','text'),('team_referrals','code','text'),('team_referrals','team_id','text'),('team_referrals','recruiter_id','text'),('team_referrals','active','bigint'),('team_referrals','created_at','bigint'),('team_referrals','revoked_at','bigint'),('team_referrals','configuration_version','bigint'),('teams','id','text'),('teams','display_name','text'),('teams','owner_id','text'),('teams','owner_name','text'),('teams','status','text'),('teams','destination_spreadsheet_id','text'),('teams','template_config','text'),('teams','configuration_version','bigint'),('teams','created_at','bigint'),('teams','updated_at','bigint'),('work_sessions','id','text'),('work_sessions','recruiter_user_id','text'),('work_sessions','recruiter_email','text'),('work_sessions','recruiter_name','text'),('work_sessions','work_date','text'),('work_sessions','time_zone','text'),('work_sessions','status','text'),('work_sessions','started_at','bigint'),('work_sessions','last_seen_at','bigint'),('work_sessions','active_seconds','bigint'),('work_sessions','ended_at','bigint'),('work_sessions','code_hash','text'),('work_sessions','code_salt','text'),('work_sessions','code_expires_at','bigint'),('work_sessions','code_sent_at','bigint'),('work_sessions','code_request_token','text'),('work_sessions','code_request_started_at','bigint'),('work_sessions','verification_attempts','bigint'),('work_sessions','verified_at','bigint'),('work_sessions','created_at','bigint'),('work_sessions','updated_at','bigint')) required(table_name,column_name,expected_type)
LEFT JOIN information_schema.columns c ON c.table_schema='public' AND c.table_name=required.table_name AND c.column_name=required.column_name
WHERE c.column_name IS NULL OR c.data_type<>required.expected_type;
SELECT c.relname AS table_name,c.relrowsecurity AS rls,
 has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS anon_has_data_access,
 has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') AS authenticated_has_data_access
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('account_setup_backups','application_attributions','applications','assignment_requests','audit','companies','completion_notifications','conversations','documents','drivers','export_deliveries','external_receipts','financial_transactions','integration_attempts','linked_messages','mutation_guards','mutation_receipts','offers','quo_events','quo_line_allocations','quo_line_profiles','quo_mappings','recruiter_contact_refill','recruiter_contact_refill_backups','recruiters','store_revision','tasks','team_memberships','team_referrals','teams','work_sessions') ORDER BY c.relname;
SELECT * FROM (
SELECT 'application_attributions.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."application_attributions" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'application_attributions.team_id -> teams.id' AS relationship, count(*) AS orphan_rows FROM public."application_attributions" child LEFT JOIN public."teams" parent ON child."team_id"=parent."id" WHERE child."team_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'applications.offer_id -> offers.id' AS relationship, count(*) AS orphan_rows FROM public."applications" child LEFT JOIN public."offers" parent ON child."offer_id"=parent."id" WHERE child."offer_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'applications.conversation_id -> conversations.id' AS relationship, count(*) AS orphan_rows FROM public."applications" child LEFT JOIN public."conversations" parent ON child."conversation_id"=parent."id" WHERE child."conversation_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'applications.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."applications" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'completion_notifications.conversation_id -> conversations.id' AS relationship, count(*) AS orphan_rows FROM public."completion_notifications" child LEFT JOIN public."conversations" parent ON child."conversation_id"=parent."id" WHERE child."conversation_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'conversations.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."conversations" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'conversations.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."conversations" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'documents.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."documents" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'drivers.owner_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."drivers" child LEFT JOIN public."recruiters" parent ON child."owner_id"=parent."id" WHERE child."owner_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'export_deliveries.team_id -> teams.id' AS relationship, count(*) AS orphan_rows FROM public."export_deliveries" child LEFT JOIN public."teams" parent ON child."team_id"=parent."id" WHERE child."team_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'external_receipts.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."external_receipts" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'external_receipts.conversation_id -> conversations.id' AS relationship, count(*) AS orphan_rows FROM public."external_receipts" child LEFT JOIN public."conversations" parent ON child."conversation_id"=parent."id" WHERE child."conversation_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'financial_transactions.application_id -> applications.id' AS relationship, count(*) AS orphan_rows FROM public."financial_transactions" child LEFT JOIN public."applications" parent ON child."application_id"=parent."id" WHERE child."application_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'integration_attempts.application_id -> applications.id' AS relationship, count(*) AS orphan_rows FROM public."integration_attempts" child LEFT JOIN public."applications" parent ON child."application_id"=parent."id" WHERE child."application_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'linked_messages.company_id -> companies.id' AS relationship, count(*) AS orphan_rows FROM public."linked_messages" child LEFT JOIN public."companies" parent ON child."company_id"=parent."id" WHERE child."company_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'linked_messages.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."linked_messages" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'offers.company_id -> companies.id' AS relationship, count(*) AS orphan_rows FROM public."offers" child LEFT JOIN public."companies" parent ON child."company_id"=parent."id" WHERE child."company_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'quo_events.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."quo_events" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'quo_events.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."quo_events" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'quo_line_allocations.line_id -> quo_line_profiles.id' AS relationship, count(*) AS orphan_rows FROM public."quo_line_allocations" child LEFT JOIN public."quo_line_profiles" parent ON child."line_id"=parent."id" WHERE child."line_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'quo_line_allocations.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."quo_line_allocations" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'quo_line_profiles.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."quo_line_profiles" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'quo_mappings.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."quo_mappings" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'tasks.owner_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."tasks" child LEFT JOIN public."recruiters" parent ON child."owner_id"=parent."id" WHERE child."owner_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'tasks.driver_id -> drivers.id' AS relationship, count(*) AS orphan_rows FROM public."tasks" child LEFT JOIN public."drivers" parent ON child."driver_id"=parent."id" WHERE child."driver_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'team_memberships.team_id -> teams.id' AS relationship, count(*) AS orphan_rows FROM public."team_memberships" child LEFT JOIN public."teams" parent ON child."team_id"=parent."id" WHERE child."team_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'team_memberships.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."team_memberships" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'team_referrals.recruiter_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."team_referrals" child LEFT JOIN public."recruiters" parent ON child."recruiter_id"=parent."id" WHERE child."recruiter_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'team_referrals.team_id -> teams.id' AS relationship, count(*) AS orphan_rows FROM public."team_referrals" child LEFT JOIN public."teams" parent ON child."team_id"=parent."id" WHERE child."team_id" IS NOT NULL AND parent."id" IS NULL
UNION ALL
SELECT 'teams.owner_id -> recruiters.id' AS relationship, count(*) AS orphan_rows FROM public."teams" child LEFT JOIN public."recruiters" parent ON child."owner_id"=parent."id" WHERE child."owner_id" IS NOT NULL AND parent."id" IS NULL
) relationships ORDER BY relationship;
SELECT count(*) AS auth_accounts FROM auth.users;
COMMIT;

CREATE TABLE `_tti_export_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tti_one_active_export` ON `_tti_export_runs` (`owner_user_id`) WHERE "_tti_export_runs"."status"='ready';--> statement-breakpoint
CREATE TABLE `_tti_export_account_setup_backups` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`created_at` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_application_attributions` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`application_id` text,
	`source` text,
	`source_submission_id` text,
	`team_id` text,
	`team_name` text,
	`team_owner_id` text,
	`team_owner_name` text,
	`team_referral_code` text,
	`original_recruiter_referral_code` text,
	`recruiter_id` text,
	`recruiter_full_name` text,
	`attribution_status` text,
	`attribution_method` text,
	`configuration_version` integer,
	`attributed_at` integer,
	`submitted_at` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_export_deliveries` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`application_id` text,
	`version` integer,
	`team_id` text,
	`destination_spreadsheet_id` text,
	`destination_sheet_id` text,
	`destination_tab_name` text,
	`status` text,
	`attempts` integer,
	`last_error` text,
	`row_identity` text,
	`created_at` integer,
	`updated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_external_receipts` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`conversation_id` text,
	`driver_id` text,
	`received_at` integer,
	`actor_id` text,
	`source` text,
	`evidence` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_financial_transactions` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`application_id` text,
	`kind` text,
	`amount_cents` integer,
	`occurred_at` integer,
	`actor_id` text,
	`evidence` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_integration_attempts` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`application_id` text,
	`at` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_linked_messages` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`driver_id` text,
	`company_id` text,
	`channel` text,
	`status` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_mutation_guards` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`ok` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_mutation_receipts` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`actor_id` text,
	`fingerprint` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_offers` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`company_id` text,
	`version` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_quo_events` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`resource_id` text,
	`occurred_at` integer,
	`driver_id` text,
	`recruiter_id` text,
	`status` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_quo_line_allocations` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`driver_id` text,
	`line_id` text,
	`batch_id` text,
	`allocated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_applications` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`driver_id` text,
	`conversation_id` text,
	`offer_id` text,
	`terms_version` text,
	`stage` text,
	`hq` text,
	`crm` text,
	`notification` text,
	`lease_token` text,
	`lease_at` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_quo_line_profiles` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`display_name` text,
	`phone` text,
	`recruiter_id` text,
	`created_at` integer,
	`updated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_quo_mappings` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`recruiter_id` text,
	`verified_at` integer,
	`actor_id` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_recruiter_contact_refill` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`run_id` text,
	`recruiter_id` text,
	`email` text,
	`target` integer,
	`available_before` integer,
	`needed` integer,
	`eligible_pool` integer,
	`assigned` integer,
	`available_after` integer,
	`status` text,
	`created_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_recruiter_contact_refill_backups` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`run_id` text,
	`driver_id` text,
	`recruiter_id` text,
	`before_json` text,
	`before_next_action` text,
	`applied` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_recruiters` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`user_id` text,
	`email` text,
	`role` text,
	`active` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_store_revision` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` integer,
	`value` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_tasks` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`driver_id` text,
	`owner_id` text,
	`kind` text,
	`due_at` integer,
	`status` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_team_memberships` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`recruiter_id` text,
	`team_id` text,
	`active` integer,
	`effective_from` integer,
	`effective_to` integer,
	`full_name_from_quo` text,
	`quo_user_id` text,
	`updated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_team_referrals` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`code` text,
	`team_id` text,
	`recruiter_id` text,
	`active` integer,
	`created_at` integer,
	`revoked_at` integer,
	`configuration_version` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_teams` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`display_name` text,
	`owner_id` text,
	`owner_name` text,
	`status` text,
	`destination_spreadsheet_id` text,
	`template_config` text,
	`configuration_version` integer,
	`created_at` integer,
	`updated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_assignment_requests` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`actor_id` text,
	`phone` text,
	`reason` text,
	`status` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_work_sessions` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`recruiter_user_id` text,
	`recruiter_email` text,
	`recruiter_name` text,
	`work_date` text,
	`time_zone` text,
	`status` text,
	`started_at` integer,
	`last_seen_at` integer,
	`active_seconds` integer,
	`ended_at` integer,
	`code_hash` text,
	`code_salt` text,
	`code_expires_at` integer,
	`code_sent_at` integer,
	`code_request_token` text,
	`code_request_started_at` integer,
	`verification_attempts` integer,
	`verified_at` integer,
	`created_at` integer,
	`updated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_audit` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`actor_id` text,
	`driver_id` text,
	`type` text,
	`at` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_companies` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`name` text,
	`status` text,
	`version` integer,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_completion_notifications` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`conversation_id` text,
	`payload_json` text,
	`status` text,
	`lease_token` text,
	`lease_at` integer,
	`message` text,
	`updated_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_conversations` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`driver_id` text,
	`recruiter_id` text,
	`status` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_documents` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`driver_id` text,
	`kind` text,
	`filename` text,
	`mime` text,
	`size` integer,
	`object_key` text,
	`actor_id` text,
	`created_at` integer,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `_tti_export_drivers` (
	`_export_id` text NOT NULL,
	`_export_row` integer NOT NULL,
	`id` text,
	`owner_id` text,
	`phone` text,
	`blocked` integer,
	`duplicate` integer,
	`batch_id` text,
	`next_action` text,
	`data_json` text,
	PRIMARY KEY(`_export_id`, `_export_row`)
);
--> statement-breakpoint
CREATE TABLE `recruiter_login_attempts` (
	`attempt_key` text NOT NULL,
	`attempted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_key_time` ON `recruiter_login_attempts` (`attempt_key`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `recruiter_login_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`recruiter_id` text NOT NULL,
	`auth_user_id` text NOT NULL,
	`email` text NOT NULL,
	`encrypted_tokens` text NOT NULL,
	`purpose` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_sessions_user` ON `recruiter_login_sessions` (`auth_user_id`);--> statement-breakpoint
CREATE INDEX `login_sessions_expiry` ON `recruiter_login_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `recruiter_login_bindings` (
	`recruiter_id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`verified_email` text NOT NULL,
	`must_change` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruiter_login_bindings_auth_user_id_unique` ON `recruiter_login_bindings` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recruiter_login_bindings_verified_email_unique` ON `recruiter_login_bindings` (`verified_email`);
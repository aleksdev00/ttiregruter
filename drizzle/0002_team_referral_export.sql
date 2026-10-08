CREATE TABLE `teams` (
  `id` text PRIMARY KEY NOT NULL,
  `display_name` text NOT NULL,
  `owner_id` text,
  `owner_name` text,
  `status` text NOT NULL DEFAULT 'active',
  `destination_spreadsheet_id` text,
  `template_config` text NOT NULL DEFAULT '{}',
  `configuration_version` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `team_memberships` (
  `recruiter_id` text PRIMARY KEY NOT NULL,
  `team_id` text NOT NULL,
  `active` integer NOT NULL DEFAULT 1,
  `effective_from` integer NOT NULL,
  `effective_to` integer,
  `full_name_from_quo` text NOT NULL,
  `quo_user_id` text,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_memberships_team` ON `team_memberships` (`team_id`);
--> statement-breakpoint
CREATE TABLE `team_referrals` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL UNIQUE,
  `team_id` text NOT NULL,
  `recruiter_id` text,
  `active` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `revoked_at` integer,
  `configuration_version` integer NOT NULL DEFAULT 1,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `application_attributions` (
  `application_id` text PRIMARY KEY NOT NULL,
  `source` text NOT NULL,
  `source_submission_id` text,
  `team_id` text,
  `team_name` text,
  `team_owner_id` text,
  `team_owner_name` text,
  `team_referral_code` text,
  `original_recruiter_referral_code` text,
  `recruiter_id` text,
  `recruiter_full_name` text,
  `attribution_status` text NOT NULL,
  `attribution_method` text NOT NULL,
  `configuration_version` integer NOT NULL,
  `attributed_at` integer NOT NULL,
  `submitted_at` integer NOT NULL,
  `data_json` text NOT NULL,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `export_deliveries` (
  `id` text PRIMARY KEY NOT NULL,
  `application_id` text NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `team_id` text,
  `destination_spreadsheet_id` text,
  `destination_sheet_id` text,
  `destination_tab_name` text,
  `status` text NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `last_error` text,
  `row_identity` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `export_application_destination` ON `export_deliveries` (`application_id`,`destination_spreadsheet_id`,`destination_sheet_id`,`version`);
--> statement-breakpoint
CREATE INDEX `export_status` ON `export_deliveries` (`status`);
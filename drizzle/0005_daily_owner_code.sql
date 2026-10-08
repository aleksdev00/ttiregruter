CREATE TABLE `work_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`recruiter_user_id` text NOT NULL,
	`recruiter_email` text NOT NULL,
	`recruiter_name` text,
	`work_date` text NOT NULL,
	`time_zone` text DEFAULT 'Europe/Belgrade' NOT NULL,
	`status` text DEFAULT 'pending_verification' NOT NULL,
	`started_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`active_seconds` integer DEFAULT 0 NOT NULL,
	`ended_at` integer,
	`code_hash` text,
	`code_salt` text,
	`code_expires_at` integer,
	`code_sent_at` integer,
	`code_request_token` text,
	`code_request_started_at` integer,
	`verification_attempts` integer DEFAULT 0 NOT NULL,
	`verified_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_session_recruiter_date_unique` ON `work_sessions` (`recruiter_user_id`,`work_date`);
--> statement-breakpoint
CREATE INDEX `work_session_date_idx` ON `work_sessions` (`work_date`);
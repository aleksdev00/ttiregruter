CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`terms_version` text NOT NULL,
	`stage` text NOT NULL,
	`hq` text DEFAULT 'pending' NOT NULL,
	`crm` text DEFAULT 'pending' NOT NULL,
	`notification` text DEFAULT 'disabled' NOT NULL,
	`lease_token` text,
	`lease_at` integer,
	`data_json` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_conversation_offer` ON `applications` (`conversation_id`,`offer_id`);
--> statement-breakpoint
CREATE INDEX `applications_driver` ON `applications` (`driver_id`);
--> statement-breakpoint
CREATE TABLE `assignment_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`phone` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`at` integer NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`driver_id` text,
	`type` text NOT NULL,
	`at` integer NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_driver` ON `audit` (`driver_id`);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`recruiter_id` text NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `conversations_driver` ON `conversations` (`driver_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_per_recruiter` ON `conversations` (`recruiter_id`) WHERE "conversations"."status" IN ('active','paused');
--> statement-breakpoint
CREATE UNIQUE INDEX `one_active_per_driver` ON `conversations` (`driver_id`) WHERE "conversations"."status" IN ('active','paused');
--> statement-breakpoint
CREATE TABLE `drivers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text,
	`phone` text,
	`blocked` integer DEFAULT 0 NOT NULL,
	`duplicate` integer DEFAULT 0 NOT NULL,
	`batch_id` text,
	`next_action` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `drivers_phone_unique` ON `drivers` (`phone`);
--> statement-breakpoint
CREATE INDEX `drivers_owner` ON `drivers` (`owner_id`);
--> statement-breakpoint
CREATE TABLE `mutation_guards` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "mutation_must_claim_revision" CHECK("mutation_guards"."ok"=1)
);
--> statement-breakpoint
CREATE TABLE `linked_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text,
	`company_id` text,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`version` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quo_events` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_id` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`driver_id` text,
	`recruiter_id` text,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quo_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`recruiter_id` text NOT NULL,
	`verified_at` integer NOT NULL,
	`actor_id` text NOT NULL,
	FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mutation_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recruiters` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruiters_user_id_unique` ON `recruiters` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `recruiters_email_unique` ON `recruiters` (`email`);
--> statement-breakpoint
CREATE TABLE `store_revision` (
	`id` integer PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`driver_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`kind` text NOT NULL,
	`due_at` integer,
	`status` text NOT NULL,
	`data_json` text NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_owner_due` ON `tasks` (`owner_id`,`due_at`);
--> statement-breakpoint
CREATE TABLE `financial_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`occurred_at` integer NOT NULL,
	`actor_id` text NOT NULL,
	`evidence` text NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "nonnegative_cents" CHECK("financial_transactions"."amount_cents">=0)
);
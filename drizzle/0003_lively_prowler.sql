CREATE TABLE `quo_line_allocations` (
	`driver_id` text PRIMARY KEY NOT NULL,
	`line_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`allocated_at` integer NOT NULL,
	FOREIGN KEY (`driver_id`) REFERENCES `drivers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`line_id`) REFERENCES `quo_line_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quo_allocations_line` ON `quo_line_allocations` (`line_id`);
--> statement-breakpoint
CREATE TABLE `quo_line_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`phone` text NOT NULL,
	`recruiter_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`recruiter_id`) REFERENCES `recruiters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quo_line_profiles_phone_unique` ON `quo_line_profiles` (`phone`);
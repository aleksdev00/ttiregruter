CREATE TABLE `completion_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text NOT NULL,
	`lease_token` text,
	`lease_at` integer,
	`message` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `completion_notifications_conversation_id_unique` ON `completion_notifications` (`conversation_id`);
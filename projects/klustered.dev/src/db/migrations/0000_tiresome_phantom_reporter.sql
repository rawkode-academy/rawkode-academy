CREATE TABLE `brackets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brackets_slug_unique` ON `brackets` (`slug`);--> statement-breakpoint
CREATE TABLE `competitors` (
	`id` text PRIMARY KEY NOT NULL,
	`bracket_id` text NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`image_url` text,
	`seed` integer,
	`user_id` text,
	`confirmed` integer DEFAULT false NOT NULL,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `competitors_bracket_idx` ON `competitors` (`bracket_id`);--> statement-breakpoint
CREATE INDEX `competitors_user_bracket_idx` ON `competitors` (`user_id`,`bracket_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`bracket_id` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`competitor1_id` text,
	`competitor2_id` text,
	`winner_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`scheduled_at` integer,
	`stream_url` text,
	`vod_url` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`bracket_id`) REFERENCES `brackets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`competitor1_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`competitor2_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`winner_id`) REFERENCES `competitors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `matches_bracket_idx` ON `matches` (`bracket_id`);--> statement-breakpoint
CREATE INDEX `matches_round_idx` ON `matches` (`bracket_id`,`round`);
CREATE TABLE `email_preference_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`audience` text NOT NULL,
	`action` text NOT NULL,
	`occurred_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_pref_events_user_idx` ON `email_preference_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_pref_events_audience_idx` ON `email_preference_events` (`audience`);--> statement-breakpoint
CREATE TABLE `email_preferences` (
	`user_id` text NOT NULL,
	`channel` text NOT NULL,
	`audience` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `channel`, `audience`)
);
--> statement-breakpoint
CREATE INDEX `email_preferences_user_idx` ON `email_preferences` (`user_id`);
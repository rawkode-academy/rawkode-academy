ALTER TABLE `bracket_applications` ADD `status` text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
ALTER TABLE `bracket_applications` ADD `reviewed_at` integer;
--> statement-breakpoint
ALTER TABLE `bracket_applications` ADD `reviewed_by_user_id` text;

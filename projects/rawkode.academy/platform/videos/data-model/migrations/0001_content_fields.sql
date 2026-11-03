PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_videos` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`tagline` text,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`what_you_will_learn` text,
	`duration` integer,
	`audio_file_size` integer,
	`publishedAt` integer NOT NULL,
	`type` text,
	`category` text,
	`youtube_id` text,
	`realtime_kit` text,
	`resources` text,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_videos`("id", "title", "subtitle", "slug", "description", "duration", "publishedAt") SELECT "id", "title", "subtitle", "slug", "description", "duration", "publishedAt" FROM `videos`;--> statement-breakpoint
DROP TABLE `videos`;--> statement-breakpoint
ALTER TABLE `__new_videos` RENAME TO `videos`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `videos_slug_unique` ON `videos` (`slug`);
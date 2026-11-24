CREATE TABLE `video_channels` (
	`video_id` text NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_channels_video_platform_unique` ON `video_channels` (`video_id`,`platform`);--> statement-breakpoint
CREATE UNIQUE INDEX `video_channels_platform_external_unique` ON `video_channels` (`platform`,`external_id`);
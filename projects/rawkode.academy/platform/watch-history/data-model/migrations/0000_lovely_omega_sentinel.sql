CREATE TABLE `watch_history` (
	`user_id` text NOT NULL,
	`video_id` text NOT NULL,
	`position_seconds` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `video_id`)
);

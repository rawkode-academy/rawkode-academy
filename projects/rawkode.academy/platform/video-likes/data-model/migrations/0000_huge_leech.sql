CREATE TABLE `video_likes` (
	`video_id` text NOT NULL,
	`person_id` text NOT NULL,
	`liked_at` integer NOT NULL,
	PRIMARY KEY(`video_id`, `person_id`)
);

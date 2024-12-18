CREATE TABLE `chapters` (
	`video_id` text NOT NULL,
	`seconds` integer NOT NULL,
	`title` text NOT NULL,
	PRIMARY KEY(`video_id`, `seconds`)
);

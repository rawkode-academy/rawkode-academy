CREATE TABLE `casting_credits` (
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`video_id` text NOT NULL,
	PRIMARY KEY(`person_id`, `role`, `video_id`)
);

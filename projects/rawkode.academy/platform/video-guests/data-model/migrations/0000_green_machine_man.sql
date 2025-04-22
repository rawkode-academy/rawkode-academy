CREATE TABLE `video_guests` (
	`video_id` text NOT NULL,
	`guest_id` text NOT NULL,
	PRIMARY KEY(`video_id`, `guest_id`)
);

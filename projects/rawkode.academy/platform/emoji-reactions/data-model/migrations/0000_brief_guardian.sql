CREATE TABLE `emoji_reactions` (
	`content_id` text NOT NULL,
	`person_id` text NOT NULL,
	`emoji` text NOT NULL,
	`reacted_at` integer,
	`content_timestamp` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`content_id`, `person_id`, `emoji`, `content_timestamp`)
);

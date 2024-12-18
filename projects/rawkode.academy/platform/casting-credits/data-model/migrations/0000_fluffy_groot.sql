CREATE TABLE `casting-credits` (
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	`content_id` text NOT NULL,
	PRIMARY KEY(`person_id`, `role`, `content_id`)
);

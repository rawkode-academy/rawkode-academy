CREATE TABLE `people_links` (
	`person_id` text NOT NULL,
	`url` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`person_id`, `url`)
);

CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`started_at` integer NOT NULL,
	`participants_joined` integer DEFAULT 0,
	`participants_left` integer DEFAULT 0,
	`finished_at` integer
);

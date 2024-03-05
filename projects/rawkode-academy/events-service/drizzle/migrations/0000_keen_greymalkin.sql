CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`show` text,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`startTime` text NOT NULL,
	`endTime` text NOT NULL,
	`recurrence` text
);

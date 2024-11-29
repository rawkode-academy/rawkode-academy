CREATE TABLE `show_hosts` (
	`show_id` text NOT NULL,
	`host_id` text NOT NULL,
	PRIMARY KEY(`host_id`, `show_id`)
);

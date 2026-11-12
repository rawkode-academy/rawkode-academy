CREATE TABLE `testimonials` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`quote` text NOT NULL,
	`author_name` text NOT NULL,
	`author_title` text NOT NULL,
	`author_image` text NOT NULL,
	`author_link` text,
	`updated_at` integer
);

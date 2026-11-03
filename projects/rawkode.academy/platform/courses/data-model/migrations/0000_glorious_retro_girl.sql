CREATE TABLE `course_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`slug` text NOT NULL,
	`frontmatter_slug` text,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`cover_url` text,
	`cover_alt` text,
	`cover_width` integer,
	`cover_height` integer,
	`section` text,
	`sort_order` integer NOT NULL,
	`video` text,
	`duration` integer,
	`difficulty` text,
	`published_at` integer NOT NULL,
	`draft` integer DEFAULT true NOT NULL,
	`authors` text NOT NULL,
	`resources` text,
	`body` text NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_modules_course_id_slug_unique` ON `course_modules` (`course_id`,`slug`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`cover_url` text,
	`cover_alt` text,
	`cover_width` integer,
	`cover_height` integer,
	`published_at` integer NOT NULL,
	`difficulty` text NOT NULL,
	`learning_path` text NOT NULL,
	`authors` text NOT NULL,
	`technologies` text NOT NULL,
	`resources` text,
	`signup_config` text,
	`body` text NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `learning_paths` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`difficulty` text NOT NULL,
	`estimated_duration` integer NOT NULL,
	`prerequisites` text NOT NULL,
	`technologies` text NOT NULL,
	`published_at` integer NOT NULL,
	`authors` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` integer
);

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`parent_id` text,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "post_id", "parent_id", "author", "body", "created_at") SELECT "id", "post_id", "parent_id", "author", "body", "created_at" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `comments_post_id_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE INDEX `comments_parent_id_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_post_id_created_at_idx` ON `comments` (`post_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`url` text,
	`body` text,
	`author` text NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_posts`("id", "title", "category", "url", "body", "author", "comment_count", "created_at") SELECT "id", "title", "category", "url", "body", "author", "comment_count", "created_at" FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE INDEX `posts_created_at_idx` ON `posts` (`created_at`);--> statement-breakpoint
CREATE INDEX `posts_category_idx` ON `posts` (`category`);--> statement-breakpoint
CREATE INDEX `posts_category_created_at_idx` ON `posts` (`category`,`created_at`);
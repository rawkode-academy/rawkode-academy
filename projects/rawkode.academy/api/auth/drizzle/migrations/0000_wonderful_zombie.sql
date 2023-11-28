CREATE TABLE `auth` (
	`handle` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`token` text,
	`tokenExpires` integer,
	`refreshToken` text,
	`refreshTokenExpires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_email_unique` ON `auth` (`email`);
-- Seed Comtrya OAuth client for code.rawkode.academy.
-- Trusted clients are configured in src/lib/auth.ts; the row keeps token FKs valid.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
	'comtrya',
	'Comtrya',
	'comtrya',
	'pkce-public-client-placeholder',
	'["https://code.rawkode.academy/auth/oidc/rawkode/callback"]',
	'public',
	0,
	unixepoch() * 1000,
	unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;
--> statement-breakpoint
CREATE TABLE `access_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`client_id` text NOT NULL,
	`role` text NOT NULL,
	`granted_by_user_id` text,
	`reason` text,
	`expires_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accessAssignment_userClientRole_unique` ON `access_assignment` (`user_id`,`client_id`,`role`);
--> statement-breakpoint
CREATE INDEX `accessAssignment_userId_idx` ON `access_assignment` (`user_id`);
--> statement-breakpoint
CREATE INDEX `accessAssignment_clientId_idx` ON `access_assignment` (`client_id`);
--> statement-breakpoint
CREATE INDEX `accessAssignment_role_idx` ON `access_assignment` (`role`);
--> statement-breakpoint

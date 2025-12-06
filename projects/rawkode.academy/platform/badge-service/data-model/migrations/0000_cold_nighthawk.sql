CREATE TABLE `badge_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`achievement_type` text NOT NULL,
	`credential_json` text NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer
);

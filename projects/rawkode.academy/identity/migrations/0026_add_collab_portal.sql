-- Partner portal (collab.rawkode.academy).
--
-- 1. Pending memberships: an admin adds someone to an organisation by GitHub
--    handle before they have ever signed in. Sign-in is GitHub-only and GitHub
--    emails are often private, so the invitation table (keyed by email) cannot
--    match them. The row is keyed by GitHub's numeric user id, which never
--    changes, and is claimed on the person's next sign-in.
CREATE TABLE `pending_member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`github_id` text NOT NULL,
	`github_login` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`invited_by_user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pendingMember_org_github_unique` ON `pending_member` (`organization_id`,`github_id`);
--> statement-breakpoint
CREATE INDEX `pendingMember_githubId_idx` ON `pending_member` (`github_id`);
--> statement-breakpoint

-- 2. Public PKCE client for the portal.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'rawkode-collab', 'Rawkode Partner Portal', 'rawkode-collab',
  'pkce-public-client-placeholder',
  '["https://collab.rawkode.academy/api/auth/callback","http://localhost:4323/api/auth/callback"]',
  'public', 0, unixepoch() * 1000, unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;
--> statement-breakpoint

-- 3. The owner administers the portal. Granted by the linked GitHub account
--    (145816 is `rawkode`), as in 0025.
INSERT INTO access_assignment (id, user_id, client_id, role, reason)
SELECT lower(hex(randomblob(16))), user_id, 'rawkode-collab', 'collab_admin', 'Owner (GitHub rawkode)'
FROM account
WHERE provider_id = 'github' AND account_id = '145816'
ON CONFLICT(user_id, client_id, role) DO NOTHING;

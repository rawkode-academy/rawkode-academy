-- Rawkode Chat is now a tenant on hosted Waddle: the server at
-- waddle.rawkode.chat signs users in as client waddle-rawkode-chat, and the
-- web client is served from rawkode.chat. The rawkode-chat client belonged to
-- the retired self-hosted server; src/lib/auth.ts no longer registers it.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'waddle-rawkode-chat',
  'Rawkode Chat',
  'waddle-rawkode-chat',
  'pkce-public-client-placeholder',
  '["https://waddle.rawkode.chat/api/auth/callback"]',
  'public',
  0,
  unixepoch() * 1000,
  unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;
--> statement-breakpoint
-- access_assignment.client_id has no foreign key, so delete those rows first.
DELETE FROM access_assignment
WHERE client_id IN ('rawkode-chat');
--> statement-breakpoint
DELETE FROM oauth_access_token
WHERE client_id IN ('rawkode-chat');
--> statement-breakpoint
DELETE FROM oauth_consent
WHERE client_id IN ('rawkode-chat');
--> statement-breakpoint
DELETE FROM oauth_application
WHERE client_id IN ('rawkode-chat');

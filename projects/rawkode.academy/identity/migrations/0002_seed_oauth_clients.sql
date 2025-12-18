-- Seed trusted OAuth clients into the database to fix foreign key constraint issues
-- These clients are also defined in trustedClients config for skipConsent behavior

INSERT INTO oauth_application (id, name, client_id, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'rawkode-academy-website',
  'Rawkode Academy',
  'rawkode-academy-website',
  '["https://rawkode.academy/api/auth/oauth2/callback/id-rawkode-academy","http://localhost:4321/api/auth/oauth2/callback/id-rawkode-academy"]',
  'web',
  0,
  unixepoch() * 1000,
  unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;
--> statement-breakpoint
INSERT INTO oauth_application (id, name, client_id, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'klustered-live',
  'Klustered Live',
  'klustered-live',
  '["https://klustered.live/api/auth/callback","http://localhost:4322/api/auth/callback"]',
  'web',
  0,
  unixepoch() * 1000,
  unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

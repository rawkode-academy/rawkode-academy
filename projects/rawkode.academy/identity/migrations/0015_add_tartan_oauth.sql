-- Seed the Tartan OIDC client for the new code.rawkode.academy forge.
-- The trusted client is configured in src/lib/auth.ts; this row keeps token FKs valid.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
	'tartan',
	'Tartan',
	'tartan',
	'pkce-public-client-placeholder',
	'["https://code.rawkode.academy/-/auth/callback"]',
	'public',
	0,
	unixepoch() * 1000,
	unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

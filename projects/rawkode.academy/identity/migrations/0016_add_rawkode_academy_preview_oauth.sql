-- Seed the Rawkode Academy Preview OAuth client.
-- The trusted client is configured in src/lib/auth.ts; this row keeps token FKs valid.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
	'rawkode-academy-preview',
	'Rawkode Academy Preview',
	'rawkode-academy-preview',
	'pkce-public-client-placeholder',
	'["https://preview.rawkode.academy/api/auth/callback","http://127.0.0.1:3100/api/auth/callback"]',
	'public',
	0,
	unixepoch() * 1000,
	unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

-- Seed the production Rawkode Academy CMS (Payload) OAuth client.
-- The trusted client is configured in src/lib/auth.ts; this row keeps token FKs valid.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
	'rawkode-academy-payload',
	'Rawkode Academy CMS',
	'rawkode-academy-payload',
	'pkce-public-client-placeholder',
	'["https://admin.rawkode.academy/api/auth/callback","https://preview.rawkode.academy/api/auth/callback"]',
	'public',
	0,
	unixepoch() * 1000,
	unixepoch() * 1000
)
ON CONFLICT(client_id) DO UPDATE SET
	redirect_urls = excluded.redirect_urls,
	updated_at = excluded.updated_at;

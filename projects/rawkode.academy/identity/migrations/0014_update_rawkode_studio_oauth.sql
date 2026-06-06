-- Register the rawkode.studio apex domain for Studio OAuth callbacks.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
	'rawkode-studio',
	'Rawkode Studio',
	'rawkode-studio',
	'pkce-public-client-placeholder',
	'["https://rawkode.studio/api/auth/callback","https://studio.rawkode.academy/api/auth/callback","http://localhost:4323/api/auth/callback"]',
	'public',
	0,
	unixepoch() * 1000,
	unixepoch() * 1000
)
ON CONFLICT(client_id) DO UPDATE SET
	name = excluded.name,
	client_secret = excluded.client_secret,
	redirect_urls = excluded.redirect_urls,
	type = excluded.type,
	disabled = excluded.disabled,
	updated_at = excluded.updated_at;

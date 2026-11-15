-- Public native client; authorization code exchange requires PKCE.
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'rawkode-academy-mobile', 'Rawkode Academy Mobile', 'rawkode-academy-mobile',
  'pkce-public-client-placeholder', '["academy.rawkode.app:/oauth2redirect"]',
  'public', 0, unixepoch() * 1000, unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

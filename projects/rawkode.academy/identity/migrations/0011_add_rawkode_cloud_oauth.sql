-- Add rawkode-cloud OAuth client for Teleport OIDC on rawkode.cloud
-- Uses PKCE public client with placeholder secret due to Better Auth issue #6651

INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'rawkode-cloud',
  'Rawkode Cloud',
  'rawkode-cloud',
  'pkce-public-client-placeholder',
  '["https://rawkode.cloud/v1/webapi/oidc/callback"]',
  'public',
  0,
  unixepoch() * 1000,
  unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

-- Add rawkode-news OAuth client for rawkode.news
-- Uses PKCE public client with placeholder secret due to Better Auth issue #6651

INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'rawkode-news',
  'Rawkode News',
  'rawkode-news',
  'pkce-public-client-placeholder',
  '["https://rawkode.news/api/auth/callback","http://localhost:4321/api/auth/callback"]',
  'public',
  0,
  unixepoch() * 1000,
  unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

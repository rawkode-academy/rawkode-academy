-- Public PKCE client for mcp.rawkode.tools (the Rawkode Tools MCP server).
INSERT INTO oauth_application (id, name, client_id, client_secret, redirect_urls, type, disabled, created_at, updated_at)
VALUES (
  'rawkode-tools-mcp', 'Rawkode Tools MCP', 'rawkode-tools-mcp',
  'pkce-public-client-placeholder', '["https://mcp.rawkode.tools/oauth/callback"]',
  'public', 0, unixepoch() * 1000, unixepoch() * 1000
)
ON CONFLICT(client_id) DO NOTHING;

-- The identity admins (src/lib/admin-config.ts) start as its operators. Other
-- operators are assigned in the identity admin.
INSERT INTO access_assignment (id, user_id, client_id, role, reason)
SELECT lower(hex(randomblob(16))), id, 'rawkode-tools-mcp', 'operator', 'Identity admin'
FROM user
WHERE lower(email) IN ('david@rawkode.dev')
ON CONFLICT(user_id, client_id, role) DO NOTHING;

#!/usr/bin/env bash
# Read-only: prints how the Rawkode Tools operator role resolves in production.
# Only opaque ids, provider names, GitHub's public numeric id, roles and times
# are printed, never emails or names.
set -euo pipefail
q() { echo "== $1"; identity-bun x wrangler d1 execute identity --remote --json --command "$2"; }
q "accounts per provider (id type, lengths)" \
  "SELECT provider_id, typeof(account_id) AS id_type, count(*) AS n, min(length(account_id)) AS min_len, max(length(account_id)) AS max_len FROM account GROUP BY provider_id, typeof(account_id)"
q "accounts for GitHub 145816" \
  "SELECT user_id, provider_id, account_id, typeof(account_id) AS id_type FROM account WHERE account_id IN ('145816', 145816) OR account_id LIKE '%145816%'"
q "rawkode-tools-mcp access assignments" \
  "SELECT user_id, role, reason, expires_at, created_at FROM access_assignment WHERE client_id = 'rawkode-tools-mcp'"
q "recent rawkode-tools-mcp tokens" \
  "SELECT user_id, scopes, created_at FROM oauth_access_token WHERE client_id = 'rawkode-tools-mcp' ORDER BY created_at DESC LIMIT 5"
q "recent rawkode-tools-mcp consents" \
  "SELECT user_id, scopes, consent_given, created_at FROM oauth_consent WHERE client_id = 'rawkode-tools-mcp' ORDER BY created_at DESC LIMIT 5"
q "applied migrations (last 3)" \
  "SELECT name, applied_at FROM d1_migrations ORDER BY id DESC LIMIT 3"

-- 0024 granted the operator role by email, which missed the owner's account.
-- Sign-in is GitHub-only, so grant by the linked GitHub account instead:
-- account_id is GitHub's numeric user id (145816 is `rawkode`), which never changes.
INSERT INTO access_assignment (id, user_id, client_id, role, reason)
SELECT lower(hex(randomblob(16))), user_id, 'rawkode-tools-mcp', 'operator', 'Owner (GitHub rawkode)'
FROM account
WHERE provider_id = 'github' AND account_id = '145816'
ON CONFLICT(user_id, client_id, role) DO NOTHING;

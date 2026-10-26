-- code.rawkode.academy is gone. Drop that callback from the Comtrya client
-- only while it is still exactly the deleted URL, so any other redirect stays.
UPDATE oauth_application
SET redirect_urls = '[]',
    updated_at = unixepoch() * 1000
WHERE client_id = 'comtrya'
    AND redirect_urls = '["https://code.rawkode.academy/auth/oidc/rawkode/callback"]';

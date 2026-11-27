-- The partner portal moved to collaborate.rawkode.academy. The old collab
-- host stays registered so its redirect keeps working during the move.
UPDATE oauth_application
SET redirect_urls = '["https://collaborate.rawkode.academy/api/auth/callback","https://collab.rawkode.academy/api/auth/callback","http://localhost:4323/api/auth/callback"]',
    updated_at = unixepoch() * 1000
WHERE client_id = 'rawkode-collab';

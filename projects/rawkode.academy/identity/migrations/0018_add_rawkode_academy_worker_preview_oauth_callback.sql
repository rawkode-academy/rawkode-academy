-- Allow the stable Cloudflare Worker Preview to complete Academy OIDC on its generated host.
UPDATE oauth_application
SET redirect_urls = '["https://preview.rawkode.academy/api/auth/callback","https://admin.rawkode.academy/api/auth/callback","https://pr-local-rawkode-academy-payload.rawkodeacademy.workers.dev/api/auth/callback","http://127.0.0.1:3100/api/auth/callback"]',
    updated_at = unixepoch() * 1000
WHERE client_id = 'rawkode-academy-preview';

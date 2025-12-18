-- Workaround for https://github.com/better-auth/better-auth/issues/6651
-- Better Auth incorrectly requires a secret for ID token signing even for public clients
UPDATE oauth_application SET client_secret = 'pkce-public-client-placeholder' WHERE client_id = 'klustered-live';

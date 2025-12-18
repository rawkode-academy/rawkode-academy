-- Update klustered-live to be a public client (PKCE instead of client_secret)
UPDATE oauth_application SET type = 'public' WHERE client_id = 'klustered-live';

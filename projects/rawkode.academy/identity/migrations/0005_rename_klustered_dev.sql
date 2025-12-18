-- Rename klustered-live to klustered-dev (domain changed)
-- Defer foreign key constraints for this transaction
PRAGMA defer_foreign_keys = ON;
--> statement-breakpoint
-- Update referencing tables first
UPDATE oauth_access_token SET client_id = 'klustered-dev' WHERE client_id = 'klustered-live';
--> statement-breakpoint
UPDATE oauth_consent SET client_id = 'klustered-dev' WHERE client_id = 'klustered-live';
--> statement-breakpoint
-- Now update the main table
UPDATE oauth_application
SET client_id = 'klustered-dev',
    name = 'Klustered Dev',
    redirect_urls = '["https://klustered.dev/api/auth/callback","http://localhost:4322/api/auth/callback"]'
WHERE client_id = 'klustered-live';

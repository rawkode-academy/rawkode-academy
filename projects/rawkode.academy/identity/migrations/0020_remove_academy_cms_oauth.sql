-- Drop the Academy CMS OAuth clients. Their Workers are gone, and the
-- trusted-client list in src/lib/auth.ts no longer registers them.
-- access_assignment.client_id has no foreign key, so delete those rows first.
-- Token and consent rows reference oauth_application and are removed explicitly
-- in case foreign keys are not enforced for this statement.
DELETE FROM access_assignment
WHERE client_id IN ('rawkode-academy-payload', 'rawkode-academy-preview');
--> statement-breakpoint
DELETE FROM oauth_access_token
WHERE client_id IN ('rawkode-academy-payload', 'rawkode-academy-preview');
--> statement-breakpoint
DELETE FROM oauth_consent
WHERE client_id IN ('rawkode-academy-payload', 'rawkode-academy-preview');
--> statement-breakpoint
DELETE FROM oauth_application
WHERE client_id IN ('rawkode-academy-payload', 'rawkode-academy-preview');

-- An example of adding a supporter by hand; not run by migrations.
-- Timestamps are Unix seconds. Leave ended_at NULL for an open-ended supporter.
--
--   bunx wrangler d1 execute DB --remote --config ./read-model/wrangler.jsonc --file ./data-model/seed.example.sql
INSERT INTO supporters (id, name, website_url, logo_url, started_at, ended_at)
VALUES (
	'example-co',
	'Example Co',
	'https://example.com',
	'https://content.rawkode.academy/supporters/example-co/logo.svg',
	unixepoch('2026-11-01'),
	NULL
);

-- technology_id is a Technology id from the technologies service.
-- A technology can have only one supporter.
INSERT INTO supporter_technologies (supporter_id, technology_id)
VALUES ('example-co', 'kubernetes');

-- Ending a supporter keeps the row but drops it from the wall and its technologies.
-- UPDATE supporters SET ended_at = unixepoch() WHERE id = 'example-co';

-- After any change, purge the wall and every technology page it touches
-- (the hourly change detection does the same if this is skipped):
--
--   just invalidate-content '{"tags":["supporters:example-co","technologies:kubernetes"]}'


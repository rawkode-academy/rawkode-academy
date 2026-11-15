-- The first community supporters. Swamp sponsors the swamp technology; Datum
-- supports the Academy without a technology of its own.
INSERT INTO supporters (id, name, website_url, logo_url, started_at, ended_at)
VALUES
	('swamp', 'Swamp', 'https://swamp-club.com', NULL, unixepoch('2026-11-11'), NULL),
	('datum', 'Datum', 'https://www.datum.net', NULL, unixepoch('2026-11-11'), NULL);
--> statement-breakpoint
INSERT INTO supporter_technologies (supporter_id, technology_id)
VALUES ('swamp', 'swamp');

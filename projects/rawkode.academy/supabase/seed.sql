INSERT INTO people(github_handle) VALUES ('rawkode');
INSERT INTO people(github_handle) VALUES ('bketelsen');
INSERT INTO people(github_handle) VALUES ('hidden');

INSERT INTO shows(slug, name) VALUES ('rawkode-live', 'Rawkode Live');
INSERT INTO show_hosts(show_id, person_id) VALUES ('rawkode-live', 'rawkode');

INSERT INTO episodes(slug, title, show_id, live) VALUES ('rawkode-live-1', 'Episode 1', 'rawkode-live', false);
INSERT INTO episode_guests(episode_id, person_id) VALUES ('rawkode-live-1', 'bketelsen');

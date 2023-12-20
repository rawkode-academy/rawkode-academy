-- People
insert into "people"("github_handle", "name")
	values ('rawkode', 'David Flanagan');

insert into "people"("github_handle", "name")
	values ('icepuma', 'Stefan Ruzitschka');

-- Technologies
insert into "technologies"("slug", "name")
	values ('supabase', 'Supabase');

insert into "technologies"("slug", "name")
	values ('kubernetes', 'Kubernetes');

-- Shows
insert into "shows"("slug", "name", "visibility")
	values ('rawkode-live', 'Rawkode Live', 'public');

insert into "show_hosts"("show_id", "person_id")
	values ('rawkode-live', 'rawkode');

-- Episodes
insert into "episodes"("slug", "title", "scheduled_for", "live", "thumbnail_url")
	values ('dapr', 'Hands-on Introduction to Dapr', LOCALTIMESTAMP(0) + INTERVAL '1 hour', true, 'https://i3.ytimg.com/vi/9RH5KH24Vmo/maxresdefault.jpg'),
('linkerd', 'Hands-on Introduction to Linkerd', LOCALTIMESTAMP(0) + INTERVAL '1 hour', true, 'https://i3.ytimg.com/vi/YjKpukXTQsI/maxresdefault.jpg');

insert into "episode_channel"("episode_id", "channel", "remote_id")
	values ('dapr', 'youtube', '9RH5KH24Vmo'), ('linkerd', 'youtube', 'YjKpukXTQsI');

-- Events
-- insert into "events"("name", "description", "start_time", "end_time", "channel_info")
-- 	values ('Hands-on Introduction to Dapr', 'Dapr Things', LOCALTIMESTAMP(0) + INTERVAL '1 hour', LOCALTIMESTAMP(0) + INTERVAL '2 hour', array[row ('youtube', '9RH5KH24Vmo', '{"url": "https://www.youtube.com/watch?v=9RH5KH24Vmo"}')::event_channel_info]);


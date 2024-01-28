-- users
insert into auth.users(instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
	values ('00000000-0000-0000-0000-000000000000', uuid_generate_v4(), 'authenticated', 'authenticated', 'jack@sg1.online', crypt('duringmybackswing!', gen_salt('bf')), current_timestamp, current_timestamp, current_timestamp, '{"provider":"email","providers":["email"]}', '{
  "iss": "https://api.github.com",
  "sub": "145816",
  "name": "David Flanagan",
  "email": "david@rawkode.dev",
  "full_name": "David Flanagan",
  "user_name": "rawkode",
  "avatar_url": "https://avatars.githubusercontent.com/u/145816?v=4",
  "provider_id": "145816",
  "email_verified": true,
  "phone_verified": false,
  "preferred_username": "rawkode"
}', current_timestamp, current_timestamp, '', '', '', '');

insert into auth.identities(id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)(
	select
		uuid_generate_v4(),
		id,
		format('{"sub":"%s","email":"%s"}', id::text, email)::jsonb,
		'email',
		current_timestamp,
		current_timestamp,
		current_timestamp
	from
		auth.users);

-- technologies
insert into "technologies"("slug", "name")
	values ('supabase', 'supabase');

insert into "technologies"("slug", "name")
	values ('kubernetes', 'kubernetes');

-- shows
insert into "shows"("slug", "name", "visibility")
	values ('rawkode-live', 'rawkode live', 'public');

insert into "show_hosts"("show_id", "person_id")
	values ('rawkode-live', 'rawkode');

-- videos
insert into "videos"("slug", "title", "published_at", "live", "thumbnail_url")
	values ('dapr', 'hands-on introduction to dapr', localtimestamp(0) + interval '1 hour', true, 'https://i3.ytimg.com/vi/9rh5kh24vmo/maxresdefault.jpg'),
('linkerd', 'hands-on introduction to linkerd', localtimestamp(0) + interval '1 hour', true, 'https://i3.ytimg.com/vi/yjkpukxtqsi/maxresdefault.jpg');

insert into "video_channel"("video_id", "channel", "remote_id")
	values ('dapr', 'youtube', '9rh5kh24vmo'),
('linkerd', 'youtube', 'yjkpukxtqsi');


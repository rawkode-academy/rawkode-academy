create domain "channel" as text check (value in ('website', 'youtube', 'linkedin'));

create table "episode_channel"(
	"episode_id" text references "episodes"(slug) on delete cascade,
	"channel" "channel" not null,
	"remote_id" text not null unique,
	primary key ("episode_id", "channel")
);

alter table "episode_channel" enable row level security;

create policy "episode_channel" on "episode_channel"
	for select to authenticated, anon
		using (true);

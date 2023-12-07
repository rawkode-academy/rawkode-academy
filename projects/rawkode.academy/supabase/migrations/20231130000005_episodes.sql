create type "chapter" as (
	"time" interval,
	"title" text
);

create table "episodes"(
	"slug" text not null primary key,
  "verified" boolean default false,
	"title" text not null unique,
	"show_id" text null references "shows"("slug") on update cascade on delete cascade,
	"published_at" timestamp null,
	"scheduled_for" timestamp null,
	"visibility" text default 'private',
  "description" text null,
	constraint "valid_visibility" check ("visibility" in ('private', 'unlisted', 'tier-1', 'tier-2', 'tier-3', 'public')),
	"live" boolean not null,
	constraint "valid_live_settings" check ((not "live" and "published_at" is not null) or ("scheduled_for" is not null)),
	"duration" interval null,
	constraint "valid_duration" check (duration is null or duration >= '00:00:00'::interval),
	"links" text[] null default array[] ::text[],
  "chapters" "chapter"[] null default array[] ::"chapter"[]
);

alter table episodes enable row level security;

create table "episode_guests"(
	"episode_id" text not null references "episodes"("slug") on update cascade on delete cascade,
	"person_id" "github_handle" not null references "people"("github_handle") on update cascade on delete cascade,
	primary key ("episode_id", "person_id")
);

alter table episode_guests enable row level security;

create table "episode_technologies"(
	"episode_id" text not null references "episodes"("slug") on update cascade on delete cascade,
	"technology_id" text not null references "technologies"("slug") on update cascade on delete cascade,
	primary key ("episode_id", "technology_id")
);

alter table episode_technologies enable row level security;

create function person_was_guest(github_handle "github_handle")
	returns boolean
	as $$
	select
(exists(
				select
					1
				from
					"episode_guests"
				where
					person_id = $1))
$$ stable
language sql
security definer;

create policy "episodes-public" on "episodes"
	for select to authenticated, anon
		using (true);

create policy "episode-guests-public" on "episode_guests"
	for select to authenticated, anon
		using (true);

create policy "episode-guests-public-select" on "people"
	for select to authenticated, anon
		using (person_was_guest(github_handle));


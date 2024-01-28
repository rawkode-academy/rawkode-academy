create table "videos"(
	"slug" text not null primary key,
	"title" text not null unique,
	"show_id" text null references "shows"("slug") on update cascade on delete cascade,
	"published_at" timestamp null,
	"thumbnail_url" text null,
	"description" text null,
	"visibility" text default 'private',
	constraint "valid_visibility" check ("visibility" in ('private', 'unlisted', 'tier-1', 'tier-2', 'tier-3', 'public')),
	"live" boolean not null default false,
	"links" text[] null default array[] ::text[],
	"chapters" "chapter"[] null default array[] ::"chapter"[]
);

alter table "videos" enable row level security;

create table "video_guests"(
	"video_id" text not null references "videos"("slug") on update cascade on delete cascade,
	"person_id" "github_handle" not null references "people"("github_handle") on update cascade on delete cascade,
	primary key ("video_id", "person_id")
);

alter table video_guests enable row level security;

create table "video_technologies"(
	"video_id" text not null references "videos"("slug") on update cascade on delete cascade,
	"technology_id" text not null references "technologies"("slug") on update cascade on delete cascade,
	primary key ("video_id", "technology_id")
);

alter table video_technologies enable row level security;

create function person_was_guest(
	github_handle "github_handle"
)
	returns boolean
	as $$
	select
(exists(
				select
					1
				from
					"video_guests"
				where
					person_id = $1))
$$ stable
language sql
security definer;

create policy "videos-public" on "videos"
	for select to authenticated, anon
		using (true);

create policy "video-guests-public" on "video_guests"
	for select to authenticated, anon
		using (true);

create policy "video-guests-public-select" on "people"
	for select to authenticated, anon
		using (person_was_guest(github_handle));

create table "video_channel"(
	"video_id" text references "videos"(slug) on delete cascade,
	"channel" "channel" not null,
	"remote_id" text not null unique,
	primary key ("video_id", "channel")
);

alter table "video_channel" enable row level security;

create policy "video_channel" on "video_channel"
	for select to authenticated, anon
		using (true);


create table "recurring_events"(
	"slug" text not null primary key,
	"name" text not null,
	"cover_url" text,
	"description" text,
	"start_time" time,
	"duration" interval,
	"rrule" text
);

alter table "recurring_events" enable row level security;

create table "events"(
	"slug" text not null primary key,
	"recurring_event_id" text references "recurring_events"(slug) on delete set null,
	"name" text not null,
	"cover_url" text,
	"description" text,
	"start_time" timestamp,
	"duration" interval
);

alter table "events" enable row level security;

create policy "anon event access" on "events"
	for select to anon
		using (true);

create policy "authenicated event access" on "events"
	for select to authenticated
		using (true);


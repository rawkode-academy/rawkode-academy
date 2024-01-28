create table "rsvps"(
	"event_id" text not null references "events"("slug") on delete cascade,
	"auth_id" uuid not null,
	primary key (event_id, auth_id)
);

alter table "rsvps" enable row level security;

create policy "rsvp-self" on rsvps
	for all to authenticated
	using (auth.uid() = auth_id);


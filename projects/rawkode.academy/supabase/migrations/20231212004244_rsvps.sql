create table "rsvps"(
  "id" uuid default uuid_generate_v4() primary key,
  "event_id" uuid not null references "events"("event_id") on delete cascade,
  "auth_id" uuid not null,
  unique(event_id, auth_id)
);

alter table rsvps enable row level security;

create policy "authenticated access" on rsvps for select to authenticated using(true);
create policy "authenticated delete" on rsvps for delete using (auth.uid() = auth_id);
create policy "authenticated insert" on rsvps for insert to authenticated with check (auth.uid() = auth_id);

create type event_channel as enum('youtube', 'linked-in', 'website', 'discord', 'google-meet', 'zoom');

create type event_channel_info as (
  channel event_channel,
  channel_id text,
  info jsonb
);

create table "events"(
  "event_id" uuid default uuid_generate_v4() primary key,
  "name" text not null,
  "description" text,
  "start_time" timestamp,
  "end_time" timestamp,
  "channel_info" event_channel_info[] not null check (cardinality(channel_info) > 0),

  check (start_time < end_time)
);

alter table events enable row level security;

create policy "anon event access" on events for select to anon using(true);
create policy "authenicated event access" on events for select to authenticated using(true);

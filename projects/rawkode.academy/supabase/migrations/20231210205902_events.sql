create table "events"(
  "slug" text not null primary key,
  "name" text not null,
  "cover_url" text,
  "description" text,
  "start_time" timestamp,
  "duration" interval,
);

alter table events enable row level security;

create policy "anon event access" on events for select to anon using(true);
create policy "authenicated event access" on events for select to authenticated using(true);

-- BEGIN:VEVENT
-- CREATED:20231220T191117Z
-- SUMMARY:ABC
-- STATUS:CONFIRMED
-- LAST-MODIFIED:20231220T191143Z
-- DTEND;TZID=Europe/London:20231220T022000
-- TRANSP:OPAQUE
-- UID:3i5d2t204etu836ajheh1m3qsb@google.com
-- DTSTART;TZID=Europe/London:20231220T020000
-- DTSTAMP:20231220T191143Z
-- SEQUENCE:1
-- X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC
-- RRULE:FREQ=DAILY;UNTIL=20231223T235959Z
-- END:VEVENT
-- BEGIN:VEVENT
-- CREATED:20231220T191117Z
-- SUMMARY:ABC24+
-- STATUS:CONFIRMED
-- LAST-MODIFIED:20231220T191143Z
-- DTEND;TZID=Europe/London:20231224T022000
-- TRANSP:OPAQUE
-- UID:3i5d2t204etu836ajheh1m3qsb_R20231224T020000@google.com
-- DTSTART;TZID=Europe/London:20231224T020000
-- DTSTAMP:20231220T191143Z
-- SEQUENCE:1
-- X-APPLE-TRAVEL-ADVISORY-BEHAVIOR:AUTOMATIC
-- RRULE:FREQ=DAILY
-- END:VEVENT
-- END:VCALENDAR

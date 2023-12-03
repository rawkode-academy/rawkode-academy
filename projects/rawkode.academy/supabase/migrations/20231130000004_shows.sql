create table "shows" (
  "slug" text not null primary key,
  "name" text not null,
  "description" text null,

  "visibility" text default 'private' check (
    "visibility" in ('private', 'public')
  )
);

alter table shows enable row level security;

create unique index "show_name" on "shows" ("name");

create table "show_hosts" (
  "show_id" text not null references "shows" ("slug") on update cascade on delete cascade,
  "person_id" "github_handle" not null references "people" ("github_handle") on update cascade on delete cascade,

  primary key ("show_id", "person_id")
);

alter table show_hosts enable row level security;

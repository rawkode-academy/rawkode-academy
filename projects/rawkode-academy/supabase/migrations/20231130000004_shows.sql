create table "shows"(
	"slug" text not null primary key,
	"name" text not null unique,
	"description" text null,
	"visibility" text default 'private' check ("visibility" in ('private', 'public'))
);

alter table shows enable row level security;

create unique index "show_name" on "shows"("name");

create table "show_hosts"(
	"show_id" text not null references "shows"("slug") on update cascade on delete cascade,
	"person_id" "github_handle" not null references "people"("github_handle") on update cascade on delete cascade,
	primary key ("show_id", "person_id")
);

alter table show_hosts enable row level security;

create function person_is_host(
	github_handle "github_handle"
)
	returns boolean
	as $$
	select
(exists(
				select
					1
				from
					"show_hosts"
				where
					person_id = $1))
$$ stable
language sql
security definer;

create policy "shows-public" on shows
	for select to authenticated, anon
		using (true);

create policy "show-hosts-public" on show_hosts
	for select to authenticated, anon
		using (true);

create policy "show-hosts-public-select" on people
	for select to authenticated, anon
		using (person_is_host(github_handle));


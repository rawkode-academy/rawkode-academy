-- people
--- Users of the system are actually stored in the auth.users table,
--- but we need this representation so that the users themselves can update their
--- own profiles.
create table "people"(
	"github_handle" "github_handle" not null primary key,
	"name" text null,
	"auth_id" uuid null,
	"avatar_url" text null,
	"biography" text null,
	"website" text null,
	"x_handle" "x_handle" null,
	"youtube_handle" "youtube_handle" null
);

alter table people enable row level security;

create unique index "person_auth_id" on "people"("auth_id");

create unique index "person_x_handle" on "people"("x_handle");

create unique index "person_youtube_handle" on "people"("youtube_handle");

-- sync auth.users to public.people
--- because auth is handled by supabase, we need a function and trigger
--- to replicate the data from auth.users to public.people.
create function "sync_auth_users_to_public_people"()
	returns trigger
	as $$
begin
	insert into "public"."people"("auth_id", "github_handle", "name", "avatar_url")
		values(new.id, new.raw_user_meta_data ->> 'user_name', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'avatar_url')
	on conflict(github_handle)
		do update set
			auth_id = excluded.auth_id, name = excluded.name, avatar_url = excluded.avatar_url;
	return new;
end;
$$
language plpgsql
security definer;

create trigger on_auth_user_created
	after insert on "auth"."users" for each row
	execute function "public"."sync_auth_users_to_public_people"();

-- allow self-access
create policy "people-view-self" on people
	for select
		using (auth.uid() = auth_id);


-- People
--- Users of the system are actually stored in the auth.users table,
--- but we need this representation so that the users themselves can update their
--- own profiles.
CREATE TABLE "people" (
  "id" uuid NOT NULL,
  "name" text NOT NULL,
  "avatar_url" text NOT NULL,
  "email" text NULL,
  "biography" text NULL,
  "website" text NULL,
  "github_handle" "github_handle" NOT NULL,
  "x_handle" "x_handle" NULL,
  "youtube_handle" "youtube_handle" NULL,

  PRIMARY KEY ("id"),

  CONSTRAINT "people_id" FOREIGN KEY ("id") REFERENCES "people" ("id") ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE UNIQUE INDEX "person_email" ON "people" ("email");
CREATE UNIQUE INDEX "person_github_handle" ON "people" ("github_handle");
CREATE UNIQUE INDEX "person_x_handle" ON "people" ("x_handle");
CREATE UNIQUE INDEX "person_youtube_handle" ON "people" ("youtube_handle");

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "people_view_self" ON people FOR SELECT USING (auth.uid() = id);
CREATE POLICY "people_update_self" ON people FOR UPDATE USING (auth.uid() = id);

-- Sync auth.users to public.people
--- Because auth is handled by Supabase, we need a function and trigger
--- to replicate the data from auth.users to public.people.
CREATE FUNCTION "sync_auth_users_to_public_people" ()
RETURNS trigger AS $$
BEGIN
INSERT INTO
  public.people (id, email, github_handle, "name", avatar_url)
VALUES
  (
    new.id,
    new.raw_user_meta_data ->> 'email',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
return new;
end;
$$ LANGUAGE plpgsql  security definer;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR each ROW EXECUTE PROCEDURE public.sync_auth_users_to_public_people();

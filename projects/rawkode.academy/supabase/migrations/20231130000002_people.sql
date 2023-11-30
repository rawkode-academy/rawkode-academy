-- People
--- Users of the system are actually stored in the auth.users table,
--- but we need this representation so that the users themselves can update their
--- own profiles.
CREATE TABLE "people" (
  "github_handle" "github_handle" NOT NULL,
  "auth_id" uuid NULL,
  "email" text NULL,
  "name" text NULL,
  "avatar_url" text NULL,
  "biography" text NULL,
  "website" text NULL,
  "x_handle" "x_handle" NULL,
  "youtube_handle" "youtube_handle" NULL,

  PRIMARY KEY ("github_handle")
);

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX "person_email" ON "people" ("email");
CREATE UNIQUE INDEX "person_x_handle" ON "people" ("x_handle");
CREATE UNIQUE INDEX "person_youtube_handle" ON "people" ("youtube_handle");

-- Sync auth.users to public.people
--- Because auth is handled by Supabase, we need a function and trigger
--- to replicate the data from auth.users to public.people.
CREATE FUNCTION "sync_auth_users_to_public_people" ()
RETURNS trigger AS $$
BEGIN
INSERT INTO
  public.people (auth_id, email, github_handle, "name", avatar_url)
VALUES
  (
    new.id,
    new.raw_user_meta_data ->> 'email',
    new.raw_user_meta_data ->> 'user_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
ON CONFLICT (github_handle) DO UPDATE SET auth_id = EXCLUDED.auth_id, name = EXCLUDED.name, email = EXCLUDED.email, avatar_url = EXCLUDED.avatar_url;

return new;

end;

$$ LANGUAGE plpgsql  security definer;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR each ROW EXECUTE PROCEDURE public.sync_auth_users_to_public_people();

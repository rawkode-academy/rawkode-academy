CREATE TABLE "episodes" (
  "slug" text NOT NULL,
  "draft" boolean NOT NULL DEFAULT true,
  "title" text NOT NULL,
  "show_id" text NOT NULL,
  "live" boolean NOT NULL DEFAULT true,
  "scheduled_for" timestamp NULL,
  "links" text [] NULL DEFAULT ARRAY [] :: text [],

  PRIMARY KEY ("slug"),

  CONSTRAINT "episodes_show_id" FOREIGN KEY ("show_id") REFERENCES "shows" ("slug") ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT "is_live" CHECK (
    (NOT live)
    OR (scheduled_for IS NOT NULL)
  )
);

ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

CREATE TABLE "episode_guests" (
  "episode_id" text NOT NULL,
  "person_id" "github_handle" NOT NULL,

  PRIMARY KEY ("episode_id", "person_id"),

  CONSTRAINT "episode_guests_episode_id" FOREIGN KEY ("episode_id") REFERENCES "episodes" ("slug") ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT "episode_guests_person_id" FOREIGN KEY ("person_id") REFERENCES "people" ("github_handle") ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE episode_guests ENABLE ROW LEVEL SECURITY;

CREATE TABLE "episode_technologies" (
  "episode_id" text NOT NULL,
  "technology_id" text NOT NULL,

  PRIMARY KEY ("episode_id", "technology_id"),

  CONSTRAINT "episode_technologies_episode_id" FOREIGN KEY ("episode_id") REFERENCES "episodes" ("slug") ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT "episode_technologies_technology_id" FOREIGN KEY ("technology_id") REFERENCES "technologies" ("slug") ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE episode_technologies ENABLE ROW LEVEL SECURITY;

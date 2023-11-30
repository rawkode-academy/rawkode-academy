CREATE TABLE "shows" (
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text NULL,
  "draft" boolean NOT NULL DEFAULT true,

  PRIMARY KEY ("slug")
);

CREATE UNIQUE INDEX "show_name" ON "shows" ("name");

ALTER TABLE shows ENABLE ROW LEVEL SECURITY;

CREATE TABLE "show_hosts" (
  "show_id" text NOT NULL,
  "person_id" "github_handle" NOT NULL,

  PRIMARY KEY ("show_id", "person_id"),

  CONSTRAINT "show_hosts_person_id" FOREIGN KEY ("person_id") REFERENCES "people" ("github_handle") ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT "show_hosts_show_id" FOREIGN KEY ("show_id") REFERENCES "shows" ("slug") ON UPDATE CASCADE ON DELETE CASCADE
);

ALTER TABLE show_hosts ENABLE ROW LEVEL SECURITY;


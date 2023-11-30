CREATE TABLE "technologies" (
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "aliases" text [] NULL DEFAULT ARRAY [] :: text [],
  "tags" text [] NULL DEFAULT ARRAY [] :: text [],
  "draft" boolean NOT NULL DEFAULT true,
  "tagline" text NOT NULL,
  "description" text NOT NULL,
  "website_url" text NOT NULL,
  "documentation_url" text NOT NULL,
  "logo_url" text NULL,
  "open_source" boolean NOT NULL DEFAULT false,
  "github_organization" "github_handle" NOT NULL,
  "repository_url" text NULL,

  PRIMARY KEY ("slug"),

  CONSTRAINT "open_source" CHECK (
    (open_source IS FALSE)
    OR (repository_url IS NOT NULL)
  )
);

ALTER TABLE technologies ENABLE ROW LEVEL SECURITY;

-- Slugify
-- Source: https://www.kdobson.net/2019/ultimate-postgresql-slug-function/
CREATE EXTENSION IF NOT EXISTS "unaccent";

CREATE OR REPLACE FUNCTION slugify("value" TEXT) RETURNS TEXT AS $$ -- removes accents (diacritic signs) from a given string --
    WITH "unaccented" AS (
        SELECT unaccent("value") AS "value"
    ),
    -- lowercases the string
    "lowercase" AS (
        SELECT lower("value") AS "value"
        FROM "unaccented"
    ),
    -- remove single and double quotes
    "removed_quotes" AS (
        SELECT regexp_replace("value", '[''"]+', '', 'gi') AS "value"
        FROM "lowercase"
    ),
    -- replaces anything that's not a letter, number, hyphen('-'), or underscore('_') with a hyphen('-')
    "hyphenated" AS (
        SELECT regexp_replace("value", '[^a-z0-9\\-_]+', '-', 'gi') AS "value"
        FROM "removed_quotes"
    ),
    -- trims hyphens('-') if they exist on the head or tail of the string
    "trimmed" AS (
        SELECT regexp_replace(regexp_replace("value", '\-+$', ''), '^\-', '') AS "value"
        FROM "hyphenated"
    )
SELECT "value"
FROM "trimmed";

$$ LANGUAGE SQL STRICT IMMUTABLE;

-- People
CREATE TABLE "people" (
    "id" TEXT NOT NULL GENERATED ALWAYS AS ("githubHandle") STORED,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "biography" TEXT,
    "website" TEXT,
    "githubHandle" TEXT NOT NULL CONSTRAINT "github_handle_length" CHECK (char_length("githubHandle") <= 39),
    "twitterHandle" TEXT CONSTRAINT "twitter_handle_length" CHECK (
        "twitterHandle" IS NULL
        OR (
            char_length("twitterHandle") >= 4
            AND char_length("twitterHandle") <= 15
        )
    ),
    "youtubeHandle" TEXT CONSTRAINT "youtube_handle_length" CHECK (
        "youtubeHandle" IS NULL
        OR (
            char_length("youtubeHandle") >= 3
            AND char_length("youtubeHandle") <= 30
        )
    ),
    CONSTRAINT "person_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "person_github_handle" ON "people"("githubHandle");
CREATE UNIQUE INDEX "person_twitter_handle" ON "people"("twitterHandle");
CREATE UNIQUE INDEX "person_youtube_handle" ON "people"("youtubeHandle");
CREATE UNIQUE INDEX "person_email" ON "people"("email");

-- Shows
CREATE TABLE "shows" (
    "id" TEXT NOT NULL GENERATED ALWAYS AS (slugify(name)) STORED,
    "name" TEXT NOT NULL,
    CONSTRAINT "shows_id" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "show_name" ON "shows"("name");

-- Show Hosts Function Table
CREATE TABLE "show_hosts" (
    "show" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    CONSTRAINT "show_hosts_id" PRIMARY KEY ("show", "host")
);

ALTER TABLE "show_hosts"
ADD CONSTRAINT "show_hosts_host" FOREIGN KEY ("host") REFERENCES "shows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "show_hosts"
ADD CONSTRAINT "show_hosts_show" FOREIGN KEY ("show") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hasura Flattening Views
CREATE VIEW show_hosts_view AS
SELECT show,
    people.*
FROM show_hosts
    LEFT JOIN people ON show_hosts.host = people.id;

CREATE VIEW host_shows_view AS
SELECT host,
    shows.*
FROM show_hosts
    LEFT JOIN shows ON show_hosts.show = shows.id;


-- Technologies
CREATE TABLE "technologies" (
    "id" TEXT NOT NULL GENERATED ALWAYS AS (slugify(name)) STORED,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "openSource" BOOLEAN NOT NULL DEFAULT FALSE,
    "repository" TEXT NOT NULL,
    "documentation" TEXT NOT NULL,
    "twitterHandle" TEXT CHECK (
        "twitterHandle" IS NULL
        OR (
            char_length("twitterHandle") >= 4
            AND char_length("twitterHandle") <= 15
        )
    ),
    "youtubeHandle" TEXT CHECK (
        "youtubeHandle" IS NULL
        OR (
            char_length("youtubeHandle") >= 3
            AND char_length("youtubeHandle") <= 30
        )
    ),
    CONSTRAINT "technology_id" PRIMARY KEY ("id")
);

-- Episodes
CREATE TYPE "chapter" AS ("time" INTERVAL, "title" TEXT);

CREATE TABLE "episodes" (
    "id" TEXT NOT NULL GENERATED ALWAYS AS (slugify(show || ' ' || title)) STORED,
    "title" TEXT NOT NULL,
    "show" TEXT NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT true,
    "scheduledFor" TIMESTAMP,
    CONSTRAINT is_live CHECK (
        (NOT "live")
        OR ("scheduledFor" IS NOT NULL)
    ),
    "startedAt" TIMESTAMP,
    "finishedAt" TIMESTAMP,
    "youtubeId" TEXT,
    "youtubeCategory" INTEGER,
    "chapters" chapter [] DEFAULT array []::chapter [],
    "links" TEXT [] DEFAULT array []::TEXT [],
    CONSTRAINT episode_show FOREIGN KEY(show) REFERENCES shows("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "episode_id" PRIMARY KEY ("id")
);


-- Episode Guests
CREATE TABLE "episode_guests" (
    "episode" TEXT NOT NULL,
    "guest" TEXT NOT NULL,
    CONSTRAINT "episode_guests_id" PRIMARY KEY ("episode", "guest")
);

ALTER TABLE "episode_guests"
ADD CONSTRAINT "episode_guests_episode" FOREIGN KEY ("episode") REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "episode_guests"
ADD CONSTRAINT "episode_guests_guest" FOREIGN KEY ("guest") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hasura Flattening Views
CREATE VIEW episode_guests_view AS
SELECT episode,
    people.*
FROM episode_guests
    LEFT JOIN people ON episode_guests.guest = people.id;

CREATE VIEW guest_episodes_view AS
SELECT guest,
    episodes.*
FROM episode_guests
    LEFT JOIN episodes ON episode_guests.episode = episodes.id;

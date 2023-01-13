-- People
CREATE TABLE "people" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draft" BOOLEAN NOT NULL DEFAULT TRUE,
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
    )
);

CREATE UNIQUE INDEX "person_github_handle" ON "people"("githubHandle");
CREATE UNIQUE INDEX "person_twitter_handle" ON "people"("twitterHandle");
CREATE UNIQUE INDEX "person_youtube_handle" ON "people"("youtubeHandle");
CREATE UNIQUE INDEX "person_email" ON "people"("email");

-- Shows
CREATE TABLE "shows" (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "draft" BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE UNIQUE INDEX "show_name" ON "shows"("name");

-- Show Hosts Function Table
CREATE TABLE "show_hosts" (
    "showId" TEXT NOT NULL REFERENCES "shows"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "personId" TEXT NOT NULL REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "show_hosts_id" PRIMARY KEY ("showId", "personId")
);

-- Hasura Flattening Views
CREATE VIEW show_hosts_view AS
SELECT "showId",
    people.*
FROM show_hosts
    LEFT JOIN people ON show_hosts."personId" = people.id;

CREATE VIEW host_shows_view AS
SELECT "personId",
    shows.*
FROM show_hosts
    LEFT JOIN shows ON show_hosts."showId" = shows.id;


-- Technologies
CREATE TABLE "technologies" (
    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,
    aliases TEXT [] DEFAULT array []::TEXT [],

    tags TEXT [] DEFAULT array []::TEXT [],

    draft BOOLEAN NOT NULL DEFAULT TRUE,

    tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    website TEXT NOT NULL,
    documentation TEXT NOT NULL,
    logo_url TEXT,

    open_source BOOLEAN NOT NULL DEFAULT FALSE,
    repository TEXT,

    CONSTRAINT open_source_check CHECK (
        open_source IS FALSE OR repository IS NOT NULL
    ),

    twitter_handle TEXT CHECK (
        twitter_handle IS NULL
        OR (
            char_length(twitter_handle) >= 4
            AND char_length(twitter_handle) <= 15
        )
    ),
    youtube_handle TEXT CHECK (
        youtube_handle IS NULL
        OR (
            char_length(youtube_handle) >= 3
            AND char_length(youtube_handle) <= 30
        )
    )
);

-- Episodes
CREATE TYPE "chapter" AS ("time" INTERVAL, "title" TEXT);

CREATE TABLE "episodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draft" BOOLEAN NOT NULL DEFAULT TRUE,
    "title" TEXT NOT NULL,
    "showId" TEXT NOT NULL REFERENCES shows("id") ON DELETE RESTRICT ON UPDATE CASCADE,
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
    "links" TEXT [] DEFAULT array []::TEXT []
);


-- Episode Guests
CREATE TABLE "episode_guests" (
    "episodeId" TEXT NOT NULL REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "personId" TEXT NOT NULL REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "episode_guests_id" PRIMARY KEY ("episodeId", "personId")
);

-- Hasura Flattening Views
CREATE VIEW episode_guests_view AS
SELECT "episodeId",
    people.*
FROM episode_guests
    LEFT JOIN people ON episode_guests."personId" = people.id;

CREATE VIEW guest_episodes_view AS
SELECT "personId",
    episodes.*
FROM episode_guests
    LEFT JOIN episodes ON episode_guests."episodeId" = episodes.id;


-- Episode Technologies
CREATE TABLE "episode_technologies" (
    "episodeId" TEXT NOT NULL REFERENCES "episodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    "technologyId" TEXT NOT NULL REFERENCES "technologies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "episode_technologies_id" PRIMARY KEY ("episodeId", "technologyId")
);

-- Hasura Flattening Views
CREATE VIEW episode_technologies_view AS
SELECT "episodeId",
    technologies.*
FROM episode_technologies
    LEFT JOIN technologies ON episode_technologies."technologyId" = technologies.id;

CREATE VIEW technology_episodes_view AS
SELECT "technologyId",
    episodes.*
FROM episode_technologies
    LEFT JOIN episodes ON episode_technologies."episodeId" = episodes.id;

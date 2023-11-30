-- GitHub Handles
CREATE DOMAIN "github_handle" AS text CONSTRAINT "github_handle_length" CHECK (length(VALUE) <= 39);

-- X Handles
CREATE DOMAIN "x_handle" AS text CONSTRAINT "x_handle_length" CHECK (
  (length(VALUE) >= 4)
  AND (length(VALUE) <= 15)
);

-- YouTube Handles
CREATE DOMAIN "youtube_handle" AS text CONSTRAINT "youtube_handle_length" CHECK (
  (length(VALUE) >= 3)
  AND (length(VALUE) <= 30)
);

-- Chapters
--- Primarily used to mark up segments of podcasts and video content
CREATE TYPE "chapter" AS ("time" INTERVAL, "title" TEXT);

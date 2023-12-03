-- GitHub Handles
create domain "github_handle"
  as text
  constraint "github_handle_length"
    check (length(value) <= 39);

-- x handles
create domain "x_handle"
  as text
  constraint "x_handle_length"
    check (
      (length(value) >= 4)
      and
      (length(value) <= 15)
);

-- youtube handles
create domain "youtube_handle"
  as text
  constraint "youtube_handle_length"
    check (
      (length(value) >= 3)
      and
      (length(value) <= 30)
);

-- chapters
-- primarily used to mark up segments of podcasts and video content
create type "chapter" as (
  "time" interval,
  "title" text
);

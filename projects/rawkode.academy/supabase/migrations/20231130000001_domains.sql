-- GitHub Handles
create domain "github_handle" as citext constraint "github_handle_length" check (length(value) <= 39);

-- x handles
create domain "x_handle" as citext constraint "x_handle_length" check ((length(value) >= 4)
	and (length(value) <= 15));

-- youtube handles
create domain "youtube_handle" as citext constraint "youtube_handle_length" check ((length(value) >= 3)
	and (length(value) <= 30));


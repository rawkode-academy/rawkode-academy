create table "episode_statistics" (
    "episode_id" text references "episodes"("slug") on delete cascade,
    "channel" "channel" not null,

    view_count int not null default 0,
    like_count int not null default 0,
    dislike_count int not null default 0,
    favorite_count int not null default 0,
    comment_count int not null default 0,

    primary key ("episode_id", "channel")
);

alter table "episode_statistics" enable row level security;

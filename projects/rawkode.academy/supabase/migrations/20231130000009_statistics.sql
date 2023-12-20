create table "video_statistics"(
	"video_id" text references "videos"("slug") on delete cascade,
	"channel" "channel" not null,
	view_count int not null default 0,
	like_count int not null default 0,
	dislike_count int not null default 0,
	favorite_count int not null default 0,
	comment_count int not null default 0,
	primary key ("video_id", "channel")
);

alter table "video_statistics" enable row level security;

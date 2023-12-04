create table "technologies"(
	"slug" text not null primary key,
	"name" text not null,
	"tagline" text not null,
	"description" text not null,
	"aliases" text[] null default array[] ::text[],
	"tags" text[] null default array[] ::text[],
	"logo_url" text null,
	"website_url" text not null,
	"documentation_url" text not null,
	"oss_licensed" boolean not null default false,
	"github_organization" "github_handle" null,
	"repository_url" text null,
	constraint "oss_licensed" check ((not "oss_licensed") or ("github_organization" is not null and "repository_url" is not null))
);

alter table technologies enable row level security;


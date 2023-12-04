begin;

select plan(4);

insert into shows("name", "slug") values ('show', 'show');

insert into people("github_handle", "name", "auth_id") values ('private 1', 'private 1', '0a0aaa00-00a0-0aa0-a000-00aa0a000a00');
insert into people("github_handle", "name", "auth_id") values ('private 2', 'private 2', '1a0aaa00-00a0-0aa0-a000-00aa0a000a00');
insert into people("github_handle", "name", "auth_id") values ('host', 'host', '3a0aaa00-00a0-0aa0-a000-00aa0a000a00');
insert into people("github_handle", "name", "auth_id") values ('guest', 'guest', '4a0aaa00-00a0-0aa0-a000-00aa0a000a00');

insert into show_hosts("show_id", "person_id") values ('show', 'host');

insert into episodes("show_id", "title", "slug", "live", "published_at") values ('show', 'episode', 'episode', false, now());

insert into episode_guests("episode_id", "person_id") values ('episode', 'guest');

set local role anon;

select
  results_eq(
    $$
    select count(*) from people;
    $$,
    $$
    values(2::bigint);
    $$,
    'anon can see hosts and guests'
  );

select
  results_eq(
    $$
    select count(*) from people where "github_handle" != 'host' and "github_handle" != 'guest';
    $$,
    $$
    values(0::bigint);
    $$,
    'anon cannot see normal users'
  );

set local role postgres;

CREATE OR REPLACE FUNCTION "auth"."uid"(
) RETURNS uuid AS $$
BEGIN
    RETURN '0a0aaa00-00a0-0aa0-a000-00aa0a000a00';
END;
$$ LANGUAGE plpgsql;

set local role authenticated;

\echo ========================
\echo self access
\echo ========================

select
  results_eq(
    $$
    select count(*) from people;
    $$,
    $$
    values(3::bigint);
    $$,
    'people can see themselves and public people'
  );

select
  results_eq(
    $$
    select count(*) from people where "github_handle" = 'private 2';
    $$,
    $$
    values(0::bigint);
    $$,
    'verify people cannot see private people'
  );

select * from finish();

rollback;

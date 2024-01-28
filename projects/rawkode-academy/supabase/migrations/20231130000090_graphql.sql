comment on schema public is e'@graphql({"inflect_names": true, "max_rows": 512})';

--- Let's flatten ShowHosts
create function "hosts"("shows")
	returns setof "people"
	language sql
	as $$
	select
		p
	from
		"show_hosts" sh
		join "people" p on sh."person_id" = "p".github_handle
	where
		sh."show_id" = $1.slug
$$;


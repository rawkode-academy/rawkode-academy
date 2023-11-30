-- People
--- Restrict access to people
CREATE POLICY "people-view-self" ON people FOR SELECT USING (auth.uid() = auth_id);
CREATE POLICY "people-update-self" ON people FOR UPDATE USING (auth.uid() = auth_id);

CREATE FUNCTION person_is_host(github_handle "github_handle") returns boolean as $$
    SELECT (
        EXISTS (
            SELECT 1 FROM "show_hosts" WHERE person_id=$1
        )
    )
$$ stable language sql security definer;

CREATE FUNCTION person_was_guest(github_handle "github_handle") returns boolean as $$
    SELECT (
        EXISTS (
            SELECT 1 FROM "episode_guests" WHERE person_id=$1
        )
    )
$$ stable language sql security definer;

--- Except when they're a host or have been a guest
CREATE POLICY "show-hosts-and-guests-public" ON people FOR SELECT TO authenticated, anon USING (person_is_host(github_handle) OR person_was_guest(github_handle));

-- Shows
CREATE POLICY "shows-public" ON shows FOR SELECT TO authenticated, anon USING ( true );

-- Show Hosts
CREATE POLICY "show-hosts-public" ON show_hosts FOR SELECT TO authenticated, anon USING ( true );

-- Episodes
CREATE POLICY "episodes-public" ON shows FOR SELECT TO authenticated, anon USING ( true );

-- Episode Guests
CREATE POLICY "episode-guests-public" ON shows FOR SELECT TO authenticated, anon USING ( true );

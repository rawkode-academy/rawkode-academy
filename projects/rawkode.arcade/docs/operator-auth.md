# Operator authentication

Audience and contestant sessions remain anonymous and signed with
`SESSION_SECRET`. Operators sign in with the existing Academy identity provider
at `id.rawkode.academy`. The identity provider shares its Better Auth session
cookie with `play.rawkode.academy`; Arcade forwards only the session token to
the identity Worker through its `IDENTITY` service binding. Each lookup bypasses
the cookie cache, so a revoked login cannot retain operator access through that
cache. Arcade never trusts an identity header supplied by the browser.

Signing in does not grant an operator role. An active `arcade_operators` record
must have `identity_subject` set to `academy:<identity user id>`. The immutable
Academy user ID comes from the identity provider, not the user's email. Existing
operator rows should be updated in place from their former `cf-access:<sub>`
value, preserving `arcade_operators.id` because content and room memberships
refer to it. The table's `host`, `producer`, and `moderator` roles are the only
privileged roles returned by authentication; `operator` retains its existing
producer mapping.

The Arcade sign-in link returns to `https://play.rawkode.academy` after the
Academy login. The identity provider must trust that exact origin. Every
state-changing browser API request must have an Origin matching the Arcade
request origin. The isolated test Worker is exempt because existing direct
`SELF.fetch` fixtures have no browser Origin header; preview and production are
never exempt. Joining a room is POST-only. The `/teams` GET remains read-only.

The website's own `rawkode-session` cookie is scoped to `rawkode.academy` and
cannot authenticate Arcade directly. Preview URLs under `workers.dev` cannot
receive the shared `.rawkode.academy` identity cookie, so privileged preview
testing needs a preview subdomain of `rawkode.academy`. This does not affect
anonymous preview flows.

`TICKET_SECRET` still signs short-lived room WebSocket tickets, and
`SESSION_SECRET` still signs anonymous audience sessions. Both are independent
of the Academy login and must be available to the production deployment.

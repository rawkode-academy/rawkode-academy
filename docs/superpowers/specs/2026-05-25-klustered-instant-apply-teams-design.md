# Klustered instant-apply + self-service teams — design

Date: 2026-05-25
Status: Approved for planning
Scope: `projects/rawkode.academy/platform/brackets`, `projects/rawkode.academy/website`, `projects/klustered.dev`

## Problem

The Klustered "Apply" tab on the website is a details form (bracket dropdown,
display name, email, optional team name, message) that writes a pending
`registration`. We want it to be a one-click action for a logged-in user, using
their identity. After applying, a competitor should manage their own details on
`klustered.dev`: for team editions they name their team and invite colleagues
via a shareable link; colleagues join by opening the link and signing in.

This also requires choosing **team vs individual** when a bracket is created.

## Decisions (from brainstorming)

1. **Apply targets a specific bracket.** A season has **multiple brackets**
   (e.g. S26 "Summer 2026" has a Solo bracket *and* a Team bracket). The Apply
   tab lists every open bracket of the live season as its own card;
   team/individual is the existing `brackets.kind` (`solo` | `team`). A
   competitor is season-scoped, so per-bracket intent ("entered Solo", "entered
   Team", or both) is tracked separately in a new `bracket_applications` table.
   Assumption: at most one Team bracket per season (so team formation is
   unambiguous) — see open questions.
2. **Apply creates a competitor instantly** (idempotent), linked by `userId`
   (OIDC `sub`). No pending-approval gate. The bracket itself (entries + matches)
   is still built **live on stream by the admin** — that is out of scope here
   and must not be touched by apply/team formation.
3. **Team join = auto-join on click + sign-in.** First applicant becomes the
   team captain, names the team, and gets a tokenized invite link
   (`klustered.dev/join/{token}`). Colleagues open it, sign in, and are added.
4. **Team size is capped per bracket** via a new `brackets.teamSize` (default 2);
   joining rejects once full.
5. **No email column** on competitors — identity (`id.rawkode.academy`) owns email.
6. **Reads go through GraphQL** (CQRS). The "am I already registered?" read is an
   authenticated federated query, not a write-model RPC.

## Stage model (strict separation)

| Stage | Where | Writes to |
|-------|-------|-----------|
| Apply | website Apply tab | `competitors`, `bracket_applications` |
| Form / join teams | klustered.dev `/me`, `/join/{token}` | `teams`, `teamMembers`, `team_invites`, `bracket_applications` |
| Build bracket live | klustered.dev admin (existing, **out of scope**) | `bracketEntries`, `matches` |

The admin builds each bracket live by drawing from the season's
`bracket_applications` (Solo bracket: applicant competitors; Team bracket: the
formed `teams`). That seeding UI is out of scope here; this change only produces
the data it draws from.

## How auth/reads work today (verified)

- The website's session is its own (`rawkode-session` + `SESSION` KV), but the
  browser also carries Better Auth cookies (`better-auth.session_token` /
  `__Secure-better-auth.session_token`) — see `website/src/middleware/auth.ts`,
  `website/src/actions/auth.ts`.
- The Hive gateway authenticates each request in `api/src/auth/index.ts`: it
  validates the Better Auth cookie via the `IDENTITY` service binding
  (`/auth/get-session`) and builds `{ user, session, isAuthenticated }`.
- The gateway forwards identity to subgraphs as **headers**, not a JWT
  (`api/src/transport/service-binding.ts:74-82`): `X-Gateway-User-Id`,
  `X-Gateway-User-Email`, `X-Gateway-User-Name`.
- `website/src/lib/shows/client.ts` `queryShowsApi` currently does an anonymous
  `fetch` to `https://api.rawkode.academy/` with no cookies.

**Implication:** authenticated reads already work at the gateway. The brackets
read-model only needs to consume `X-Gateway-User-Id`, and the website only needs
to forward the request's `Cookie` header on the one authenticated read.

> Do **not** copy `platform/email-preferences`' `ctx.jwt.payload.sub` pattern.
> It predates the current gateway and does not match what is actually forwarded
> (`X-Gateway-User-*` headers). Brackets reads the header.

## Component design

### A. `platform/brackets` (deploy first — both apps bind it)

#### Schema (`data-model/schema.ts` + migration)

- New table `bracket_applications` (per-bracket intent; the season competitor is
  shared across that season's brackets):
  - `id` text pk
  - `bracketId` → `brackets.id` (cascade)
  - `competitorId` → `competitors.id` (cascade)
  - `createdAt` timestamp
  - unique `(bracketId, competitorId)`
  - This is the explicit "entered this bracket" record. It is **not** a
    `bracketEntry` (no seed; the bracket is still built live). The legacy
    `registrations` table is not reused.
- New table `team_invites`:
  - `token` text pk (cuid2, opaque)
  - `teamId` → `teams.id` (cascade)
  - `seasonId` → `seasons.id` (cascade)
  - `createdByUserId` text not null
  - `createdAt` timestamp
  - `revokedAt` timestamp nullable
  - Reusable until revoked; no expiry.
- `brackets.teamSize` integer not null default 2 (meaningful only when
  `kind = "team"`; ignored for solo).

#### Write-model RPC (`write-model/main.ts`, new methods on `BracketsWriteModel`)

All take the caller's `userId` (OIDC sub) for ownership/record-keeping;
authorization is enforced at klustered.dev/website (trusted service binding),
and these methods additionally validate invariants.

- `selfRegisterCompetitor({ bracketId, userId, displayName }) → { competitorId, seasonId, bracketKind }`
  - Resolve bracket → season.
  - If a competitor with `(seasonId, userId)` exists, reuse it; else generate a
    unique `personSlug` from `displayName` (slugify + numeric dedupe within the
    season) and insert the competitor with `userId`.
  - Upsert `bracket_applications (bracketId, competitorId)` (**idempotent** on
    the unique key). This is what records "entered this specific bracket".
- `formTeam({ bracketId, name, userId }) → { teamId, token }`
  - Resolve bracket → season; verify `bracket.kind = "team"`.
  - Find caller's competitor in the season; error if none (they must have
    applied first).
  - Reject if the competitor is already on a team in this season (one team per
    competitor per season — enforced in logic; no DB unique exists).
  - Create the team (slug = slugify(name), deduped), add caller as
    `teamMembers` with `role = "captain"`, ensure
    `bracket_applications (bracketId, competitorId)`, mint a `team_invites`
    token (storing `teamId` + `seasonId`).
- `joinTeamViaInvite({ token, userId, displayName }) → { teamId, seasonId }`
  - Validate token exists and `revokedAt` is null. Resolve team + season, and
    the season's Team bracket (the `kind = "team"` bracket; assumes exactly one).
  - Ensure a competitor exists for `userId` (create like
    `selfRegisterCompetitor` if missing).
  - Reject if competitor already on a team this season, or if the team already
    has `teamBracket.teamSize` members.
  - Add as `teamMembers` (`role = "member"`), ensure
    `bracket_applications (teamBracketId, competitorId)`. Idempotent if already
    a member.
- `renameTeam({ teamId, name, userId }) → { ok }` — captain only.
- `createTeamInvite({ teamId, userId }) → { token }` — regenerate; captain/member only.
- `revokeTeamInvite({ token, userId }) → { ok }` — set `revokedAt`.
- `leaveTeam({ teamId, userId }) → { ok }` — remove caller's membership;
  if captain leaves, hand off captaincy or block (see open questions).

Add a shared `slugify`/dedupe helper used by competitor and team creation.

#### Read-model (`read-model/schema.ts` + `read-model/main.ts`)

- `main.ts`: build a Yoga context from request headers, reading
  `X-Gateway-User-Id` (and name/email if useful) into `ctx.user`.
- New header-gated field on the federated `Show` entity, e.g.
  `myParticipation`, returning a **per-bracket** list for the live season's open
  brackets:
  ```graphql
  type MyParticipation { brackets: [MyBracketParticipation!]! }
  type MyBracketParticipation {
    bracketId: String!
    bracketSlug: String!
    bracketKind: String!     # solo | team
    applied: Boolean!        # from bracket_applications
    team: MyTeam             # null unless team bracket and on a team
  }
  type MyTeam { id: String!  name: String!  slug: String!  isCaptain: Boolean!  memberCount: Int! }
  ```
  Returns empty/`applied: false` when unauthenticated (no `X-Gateway-User-Id`).
  The Apply tab uses this to render each bracket card's state (Apply vs
  "✓ Entered") and the correct manage-link.

### B. `rawkode.academy/website` (Apply tab)

- **Bind `BRACKETS_WRITE`** in `wrangler.jsonc` (currently absent → the existing
  apply form is dead). Point at `platform-brackets-write-model`. Update the
  endpoint's binding type.
- **`queryShowsApi`** (`src/lib/shows/client.ts`): accept optional request
  cookies and forward them as the `Cookie` header to the gateway when present,
  so authenticated reads (`myParticipation`) resolve the user. Anonymous reads
  unchanged.
- **`Apply.astro`** (`src/lib/shows/plugins/bracket/pages/Apply.astro`): remove
  all input fields.
  - Signed-out → "Sign in to apply" (link to the website OIDC sign-in with
    `returnTo` back to the apply tab).
  - Signed-in → one card per open bracket (S26 shows two: Solo and Team), each
    with the bracket name, **Team**/**Individual** badge, and an **Apply** button
    (POST) targeting that bracket. If `myParticipation` shows `applied` for that
    bracket → "✓ Entered" plus a CTA to `https://klustered.dev/me`: for a Team
    bracket, "Set up your team" (and, if not yet on a team, nudge to do so); for
    Solo, "Manage your profile". A user can enter Solo, Team, or both.
  - Editorial design system (see `website/CLAUDE.md`): hairline cards, mono
    labels, no shadows/blur. No em-dashes in copy.
- **`apply` endpoint** (`src/lib/shows/plugins/bracket/endpoints.ts`): read the
  user from the session; if absent return 401/redirect to sign-in. Call
  `BRACKETS_WRITE.selfRegisterCompetitor({ bracketId, userId, displayName })`.
  Redirect back to the apply tab (which then shows registered state + the
  klustered.dev link). Drop the old `teamName`/`email`/`message` fields.
- The plugin's `load(ctx)` for Apply must pass `ctx.request` cookies into
  `queryShowsApi` so the participation read is authenticated.

### C. `klustered.dev`

- **Admin bracket create form** (`src/pages/admin/brackets.astro` +
  `src/pages/api/admin/brackets.ts`): add a `kind` selector (Individual / Team)
  and, shown when Team, a `teamSize` input (default 2). Pass both to
  `bracketsWrite(env).createBracket({ ..., kind, teamSize })`.
- **`/me/team`** (new page + nav entry in `src/lib/nav.ts`):
  - Resolve the live season's **Team bracket** (the `kind = "team"` bracket;
    direct D1 read — the established klustered.dev pattern). `teamSize` comes
    from this bracket. The page is only relevant when such a bracket is open;
    otherwise show "No team bracket is open."
  - Entered the Team bracket, no team yet → "Name your team" form → POST →
    `formTeam({ bracketId: teamBracketId })` → redirect to the team view.
  - On a team → show team name (rename if captain), roster, the copyable invite
    link, and captain controls (regenerate / revoke link).
  - Show Solo-bracket status (entered / not) separately on `/me`, since a
    competitor may be in both brackets.
- **`/join/[token]`** (new page + API):
  - Add `/join` to the auth-required prefixes in `src/middleware.ts` so
    unauthenticated visitors are bounced to sign-in with `returnTo`.
  - GET shows "Join {team} for {season}" with a confirm button; confirm POSTs to
    `joinTeamViaInvite` with the logged-in user, then redirects to `/me/team`.
  - Friendly errors for invalid/revoked token, already-on-a-team, team-full.
- **`/me/profile`** (`src/pages/me/profile.astro`): fix the "edit in
  `content/people/{slug}.mdx`" note so it does not show for self-applied
  competitors whose `personSlug` has no content profile (the `getPerson` lookup
  is already best-effort; the copy is the only issue).
- **Mirror schema** in `src/db/schema.ts`: add `bracket_applications`,
  `team_invites`, and `brackets.teamSize` so klustered.dev's direct D1 reads
  compile. (klustered.dev reads D1 directly; those reads stay as-is and are not
  migrated to GraphQL in this change.)

## Data flow

```
Apply (website) — per bracket (S26 shows Solo + Team cards)
  user → Apply button on a bracket → /api/shows/klustered/apply
    → BRACKETS_WRITE.selfRegisterCompetitor({ bracketId, userId, displayName })
    → season competitor (idempotent) + bracket_applications(bracketId) → redirect
  Apply tab read → queryShowsApi(myParticipation, cookies) → gateway validates
    Better Auth cookie via IDENTITY → forwards X-Gateway-User-Id → brackets
    subgraph → per-bracket "✓ Entered" + link to klustered.dev/me

Form team (klustered.dev, Team bracket only)
  captain → /me/team → formTeam({ teamBracketId }) → team + captain member
    + bracket_applications + invite token → copyable klustered.dev/join/{token}

Join (klustered.dev)
  colleague → /join/{token} → sign in → joinTeamViaInvite
    → competitor (if missing) + teamMember + bracket_applications → /me/team

Build bracket live (admin, out of scope)
  admin draws applicants (Solo) / formed teams (Team) into bracketEntries
    + matches on stream
```

## Deploy order (service-binding rule)

1. `platform/brackets` — schema migration (`bracket_applications`,
   `team_invites`, `brackets.teamSize`), new write commands, read-model
   participation field. Deploy + apply D1 migrations first.
2. `rawkode.academy/website` — add `BRACKETS_WRITE` binding, Apply rewrite,
   cookie-forwarding read.
3. `klustered.dev` — admin `kind`/`teamSize`, `/me/team`, `/join/{token}`,
   schema mirror.

Website PR CI preview-deploys and validates bindings, so the brackets service
must be live before the website binding lands.

## Testing

- **brackets write-model**: unit/integration tests for `selfRegisterCompetitor`
  (competitor idempotency + slug dedupe + `bracket_applications` upsert, incl.
  applying to both Solo and Team in one season), `formTeam`
  (one-team-per-season, captain role, kind=team guard), `joinTeamViaInvite`
  (token valid/revoked, team-full cap, already-on-team, records application),
  `renameTeam`/`revokeTeamInvite` ownership. Follow the existing `tests/` setup.
- **brackets read-model**: `myParticipation` returns the correct per-bracket
  list for authenticated vs anonymous (header present/absent), reflects
  per-bracket `applied` and team membership.
- **website**: Apply tab renders signed-out / signed-in / registered states;
  endpoint calls `selfRegisterCompetitor` with session identity; anonymous read
  path unaffected.
- **klustered.dev**: bracket creation persists `kind` + `teamSize`; `/me/team`
  create + invite + roster; `/join/{token}` happy path and rejections.

## Human action required

- Confirm `platform-brackets-write-model` is deployed before merging the website
  `BRACKETS_WRITE` binding (it already is, since klustered.dev binds it).
- Apply the brackets D1 migration to the `platform-brackets` database.
- No new secrets/vars expected (admin allowlist `KLUSTERED_ADMIN_IDS` already
  exists; identity/session bindings already exist on both apps).

## Open questions (resolve during planning)

1. **One Team bracket per season (teams are season-scoped).** Seasons have
   multiple brackets (Solo + Team for S26), and `teams`/`teamMembers` reference
   `seasonId`, not `bracketId`. Team formation therefore assumes exactly one
   `kind = "team"` bracket per season. If you ever want two Team brackets in one
   season (e.g. "Team Beginner" + "Team Pro"), `teams` must become
   bracket-scoped (add `teams.bracketId`), which also touches the admin teams UI
   and `generateBracket`'s "this season's teams" query. Decision needed: keep
   season-scoped teams + the one-Team-bracket assumption now, or make teams
   bracket-scoped up front.
2. **Captain leaving.** If a captain `leaveTeam`s, do we promote the oldest
   member, block until reassigned, or dissolve the team?
3. **Where `myParticipation` hangs.** As a field on the federated `Show` entity
   vs a root query. Prefer extending `Show` to match the existing read shape.
4. **Invite link reuse vs per-invite.** One reusable link per team (revocable)
   is assumed; confirm we don't need single-use tokens.

## Out of scope

- Building the live bracket (`bracketEntries`, matches) — the admin's on-stream
  flow, unchanged here.
- Migrating klustered.dev's direct D1 reads to GraphQL.
- Profile editing beyond team name (display name / bio edits not requested).
- The legacy `registrations` table and its admin approval UI (the new flow
  bypasses it; left intact, not removed in this change).

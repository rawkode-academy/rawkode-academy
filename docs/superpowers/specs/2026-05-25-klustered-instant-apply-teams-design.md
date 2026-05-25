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

1. **Apply targets a bracket.** Only one season is ever live at a time, so the
   Apply tab lists the live season's open bracket(s); team/individual is the
   existing `brackets.kind` (`solo` | `team`).
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
| Apply | website Apply tab | `competitors` only |
| Form / join teams | klustered.dev `/me`, `/join/{token}` | `teams`, `teamMembers`, `team_invites` |
| Build bracket live | klustered.dev admin (existing, **out of scope**) | `bracketEntries`, `matches` |

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
  - If a competitor with `(seasonId, userId)` exists, return it (**idempotent**).
  - Else generate a unique `personSlug` from `displayName` (slugify + numeric
    dedupe within the season) and insert the competitor with `userId`.
- `formTeam({ seasonId, name, userId }) → { teamId, token }`
  - Find caller's competitor in the season; error if none.
  - Reject if the competitor is already on a team this season (one team per
    competitor per season — enforced in logic; no DB unique exists).
  - Create the team (slug = slugify(name), deduped), add caller as
    `teamMembers` with `role = "captain"`, mint a `team_invites` token.
- `joinTeamViaInvite({ token, userId, displayName }) → { teamId, seasonId }`
  - Validate token exists and `revokedAt` is null.
  - Resolve team + season. Ensure a competitor exists for `userId` (create like
    `selfRegisterCompetitor` if missing).
  - Reject if competitor already on a team this season, or if the team already
    has `bracket.teamSize` members. (Team size: read the relevant team bracket's
    `teamSize`; see open question below if a season can host multiple brackets.)
  - Add as `teamMembers` (`role = "member"`); idempotent if already a member.
- `renameTeam({ teamId, name, userId }) → { ok }` — captain only.
- `createTeamInvite({ teamId, userId }) → { token }` — regenerate; captain/member only.
- `revokeTeamInvite({ token, userId }) → { ok }` — set `revokedAt`.
- `leaveTeam({ teamId, userId }) → { ok }` — remove caller's membership;
  if captain leaves, hand off captaincy or block (see open questions).

Add a shared `slugify`/dedupe helper used by competitor and team creation.

#### Read-model (`read-model/schema.ts` + `read-model/main.ts`)

- `main.ts`: build a Yoga context from request headers, reading
  `X-Gateway-User-Id` (and name/email if useful) into `ctx.user`.
- New JWT/header-gated field, e.g. extend the `Show` entity:
  `myParticipation(showId via entity): MyParticipation` returning, for the live
  season's open brackets, whether the caller is a registered competitor and
  which team they are on (and `bracketKind`). Returns null/empty when
  unauthenticated. Used by the website Apply tab to render "✓ Registered" and
  the correct manage-link.

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
  - Signed-in → one card per open bracket: season name, **Team**/**Individual**
    badge, **Apply** button (POST). If `myParticipation` shows already
    registered → "✓ Registered" plus a CTA to `https://klustered.dev/me`
    ("Set up your team" for team kind, "Manage your profile" for solo).
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
  - Determine the competitor's live-season bracket kind (direct D1 read — the
    established klustered.dev pattern).
  - Team edition, no team yet → "Name your team" form → POST → `formTeam` →
    redirect to the team view.
  - Team edition, on a team → show team name (rename if captain), roster, the
    copyable invite link, and captain controls (regenerate / revoke link).
  - Solo edition → "You're registered for {season} (Individual)" only.
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
- **Mirror schema** in `src/db/schema.ts`: add `team_invites` and
  `brackets.teamSize` so klustered.dev's direct D1 reads compile. (klustered.dev
  reads D1 directly; those reads stay as-is and are not migrated to GraphQL in
  this change.)

## Data flow

```
Apply (website)
  user → Apply button → /api/shows/klustered/apply
    → BRACKETS_WRITE.selfRegisterCompetitor({ bracketId, userId, displayName })
    → competitor (idempotent) → redirect back
  Apply tab read → queryShowsApi(myParticipation, cookies) → gateway validates
    Better Auth cookie via IDENTITY → forwards X-Gateway-User-Id → brackets
    subgraph → "✓ Registered" + link to klustered.dev/me

Form team (klustered.dev)
  captain → /me/team → formTeam → team + captain member + invite token
    → copyable klustered.dev/join/{token}

Join (klustered.dev)
  colleague → /join/{token} → sign in → joinTeamViaInvite
    → competitor (if missing) + teamMember → /me/team

Build bracket live (admin, out of scope)
  admin draws formed teams/competitors into bracketEntries + matches on stream
```

## Deploy order (service-binding rule)

1. `platform/brackets` — schema migration (`team_invites`, `brackets.teamSize`),
   new write commands, read-model participation field. Deploy + apply D1
   migrations first.
2. `rawkode.academy/website` — add `BRACKETS_WRITE` binding, Apply rewrite,
   cookie-forwarding read.
3. `klustered.dev` — admin `kind`/`teamSize`, `/me/team`, `/join/{token}`,
   schema mirror.

Website PR CI preview-deploys and validates bindings, so the brackets service
must be live before the website binding lands.

## Testing

- **brackets write-model**: unit/integration tests for `selfRegisterCompetitor`
  (idempotency, slug dedupe), `formTeam` (one-team-per-season, captain role),
  `joinTeamViaInvite` (token valid/revoked, team-full cap, already-on-team),
  `renameTeam`/`revokeTeamInvite` ownership. Follow the existing `tests/` setup.
- **brackets read-model**: `myParticipation` returns correctly for
  authenticated vs anonymous (header present/absent), reflects team membership.
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

1. **Multiple brackets per season.** Apply targets a bracket and competitors are
   season-scoped. If a live season ever has both a solo and a team bracket, how
   is team-size / kind resolved for a competitor on `/me/team`? Current
   assumption: one bracket per live season. Confirm we can rely on that, or pick
   a rule (e.g., team features key off the season's team bracket).
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

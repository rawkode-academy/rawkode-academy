# Klustered Production Launch Runbook

This runbook covers the two-app production shape:

- `klustered.live`: public site, applications, schedule, leaderboard, live banner.
- `klustered.dev`: protected admin and competitor portal.

Do not run remote D1, DNS, or deploy commands from an agent/browser session without action-time confirmation.

## One-Time Cloudflare Setup

1. Create or confirm the D1 database named `klustered`.
2. Confirm both Worker configs bind `DB` to that database name.
3. Confirm custom domains:
   - `klustered.live`
   - `www.klustered.live`
   - `klustered.dev`
4. Remove any Cloudflare redirect rule that sends `klustered.live/*` to `klustered.dev/`.
5. Confirm Worker observability destinations `grafana-traces` and `grafana-logs` exist.

The repo config intentionally omits `database_id`; Wrangler 4 marks it optional and can resolve the D1 binding by database name.

## Deploy Order

Run these from the repo root after CI is green:

```sh
bun --filter klustered-dev run check
bun --filter klustered-dev run build
bun --filter klustered-live run check
bun --filter klustered-live run build
```

Apply migrations before routing traffic:

```sh
cd projects/klustered.dev
bun run db:migrate
```

Seed launch data only after reviewing the script contents:

```sh
cd projects/klustered.dev
bun run db:seed:production -- --remote --confirm-production
```

Deploy the portal first, then the public site:

```sh
cuenv ci --pipeline default --path projects/klustered.dev
cuenv ci --pipeline default --path projects/klustered.live
```

## Initial Admin Access

1. Sign in to `https://klustered.dev`.
2. Read the OIDC subject from the callback-created `sessions.user_id` row.
3. Grant the admin role:

```sh
cd projects/klustered.dev
bun run db:grant-role -- --user-id=<oidc-sub> --role=admin --remote --confirm-production
```

Use `--role=competitor` for competitor-only access.

## Launch Smoke Tests

Public site:

- `https://klustered.live/`
- `https://klustered.live/episodes`
- `https://klustered.live/schedule`
- `https://klustered.live/schedule.ics`
- `https://klustered.live/leaderboard`
- `https://klustered.live/about`
- `https://klustered.live/rules`
- `https://klustered.live/apply`
- `https://klustered.live/sponsors`
- `https://klustered.live/sitemap.xml`
- `https://klustered.live/robots.txt`

Portal:

- Anonymous `https://klustered.dev/admin` redirects to sign-in.
- Signed-in non-admin gets `403` for `/admin`.
- Admin can open seasons, competitors, teams, scenarios, brackets, matches, registrations, and live match control.
- Competitor can open `/me`, `/me/matches`, and `/me/profile`.

## Match Operations

1. Create or confirm an active season.
2. Create competitors and link their `user_id` after they sign in.
3. Create teams and assign team members.
4. Create scenarios.
5. Create a bracket, then generate matches.
6. Set match schedule, scenario, judge, and teams.
7. Start match from `/admin/matches/<id>/live`.
8. Confirm `https://klustered.live/api/live` returns the live match and the home page shows the live banner.
9. End match from the live control page.
10. Confirm leaderboard and bracket advancement.

## Rollback

1. Roll back the relevant Worker version with Wrangler or the Cloudflare dashboard.
2. Reapply the previous Cloudflare route/redirect only if the new public site is broken.
3. Do not roll back D1 destructively. If data repair is needed, export the database first.

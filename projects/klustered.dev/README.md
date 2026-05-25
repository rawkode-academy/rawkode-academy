# klustered.dev

Admin + competitor portal for the Klustered game show. Lives at `https://klustered.dev`.

## Stack

- Bun + Astro 5 (matches `projects/rawkode.academy/website`)
- Tailwind v4
- Cloudflare Workers (SSR via `@astrojs/cloudflare`)
- Cloudflare D1 + Drizzle ORM
- Shared Better Auth deployment with `rawkode.academy`

## Development

```sh
cuenv task dev       # or: bun run dev
cuenv task build     # or: bun run build
cuenv task check     # or: bun run check
cuenv task db.generate
cuenv task db.migrate
```

Set up the local D1 database before using portal or public pages that read
seasons, teams, matches, registrations, schedule, or leaderboard data:

```sh
bun run db:setup:local
```

That command runs the Wrangler local D1 migration flow and then seeds local-only
data. It does not touch the remote Cloudflare D1 database.

The companion public site lives at `../klustered.live/`.

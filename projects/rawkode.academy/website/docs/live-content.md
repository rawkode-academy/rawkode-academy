# Live content and caching

All content (videos, shows, people, technologies, articles, news, changelog,
ADRs, testimonials, courses, course modules, learning paths) lives in D1
platform services behind the GraphQL gateway. The website has no build-time
content: every content page renders on demand and is cached at the edge.

## Request path

1. Cloudflare's Workers cache serves a cached page without running the Worker.
2. On a miss, the page calls `getCollection` / `getEntry` from
   `@/lib/live-content`. These use the live collections in `src/live.config.ts`.
3. The loaders read whole collections through three layers:
   per-isolate memo → KV (`CONTENT_CACHE`) → gateway (`API` service binding to
   `platform-api-gateway`, or `GRAPHQL_ENDPOINT` without the binding).
4. Bodies are TipTap documents rendered by `renderEntry` / `renderDocument`
   (typography, technology autolinks, external links, Expressive Code,
   asides, inline diagrams, islands). Rendered HTML is cached in KV by a hash
   of the document and options.
5. The page calls `setContentCache(Astro, { entries, collections })` **in its
   own frontmatter**, which sets `Astro.cache` (provider `cacheCloudflare()`):
   tags from the entries, `maxAge` 1h + 1 day stale-while-revalidate, with
   `maxAge + swr` capped at the seconds until the next scheduled entry so it
   appears on time (no stale copy is served past that instant). Pages
   rendered from the last-good fallback, or within 2 minutes of an
   invalidation, are cached for 60 seconds only.

Astro applies the cache headers once the page frontmatter has run, before
child components render (the body streams). A `setContentCache` call from a
component is therefore ignored, and logs a warning (`contentCacheMiddleware`
in `src/middleware.ts` marks the point). The page must pass every entry and
listed collection its components show.

## Outages: primary vs secondary content

With the gateway down and nothing in KV, `getCollection` / `getEntry` throw
`ContentError`. A page's primary entity lets that propagate: the request
fails and `guardSharedCache` never stores a response of 400 or more.
Secondary sections (related rails, testimonials, continue watching, tag
labels, the cast) wrap their load in `optionalContent(load, fallback)`, which
returns the fallback on `ContentError` (and rethrows anything else), and
render nothing when it is empty. A collection listed in `setContentCache`
that cannot be loaded caps the page at 60 seconds, like a stale fallback, so
a render missing a rail is not kept for an hour.

## Personalised responses

The Workers cache key ignores cookies, so the CDN must never store a render
that differs per visitor. `setContentCache` stores nothing when
`Astro.locals.user` is set, after `disableContentCache`, or when the request
carries a cookie listed in `PERSONALISING_COOKIES`
(`src/lib/live-content/personalisation.ts`: sign-in sessions,
`astro-session`, `newsletter:*`, `lead-magnet:*`). `src/worker.ts` also
downgrades any cacheable response that sets a cookie, or answers such a
request, to `Cloudflare-CDN-Cache-Control: no-store`. If a component starts
personalising on a new cookie, add it to that list. Cached anonymous pages
are still served to signed-in visitors, so user-specific UI belongs on the
client.

## KV keys (`CONTENT_CACHE`)

| Key | Value | TTL |
|---|---|---|
| `content:generation` | `{ generation, bumpedAt }` | none |
| `content:v1:<generation>:<query>:<hash>` | `{ payload, fetchedAt }` | 24h |
| `content:last:v1:<query>:<hash>` | last good payload, served if the gateway fails | 7d |
| `render:v2:<doc hash>:<options hash>` | `{ html, headings }` (not stored when a diagram or code block fell back) | 30d |
| `diagram:v1:<hash of src>` | prepared SVG | 30d |
| `content:manifest` | hourly change-detection manifest | none |

Bumping the generation moves every payload key at once.

## Cache tags

Every entry's cache hint carries `<collection>`, `<collection>:<id>` and the
entity tags of what it references (`people:<id>` for guests and authors,
`technologies:<id>`, `shows:<id>`, `courses:<id>`). Large pages fold entity
tags into collection tags to stay under Cloudflare's header limit.

## Invalidation

Writers call, after D1 writes:

```bash
curl -X POST https://rawkode.academy/api/cache/invalidate \
  -H "Authorization: Bearer $CACHE_INVALIDATION_TOKEN" \
  -H "content-type: application/json" \
  -d '{"tags":["videos:<id>","people:<id>"]}'    # or '{"all":true}'
```

The endpoint bumps the generation and purges the tags (plus each entity tag's
collection tag; `all` purges every collection tag). It then waits about 50
seconds and purges again before answering: until then an edge can still read
the previous generation from KV's cache (30s) and an isolate's memo (10s),
render the old content and store it after the first purge. Pass
`"settle": false` to skip the second purge. A purge whose result reports a
failure answers 502 (the generation is already bumped; retrying is safe).
`just invalidate-content` wraps it.

Cached pages were rendered by the previous version, so a code deploy must
purge everything. The production deploy does it (`scripts/wrangler-deploy.ts
--purge`, once the new version answers); after a deploy by hand, run
`just invalidate-content '{"all":true}'`.

`CACHE_INVALIDATION_TOKEN` is a Worker secret. Its value lives in 1Password
(`op://sa.rawkode.academy/website-cache-invalidation/password`); cuenv resolves
it for the production environment and `scripts/wrangler-deploy.ts` uploads it
with every deploy and preview (`wrangler --secrets-file`). Locally, put it in
`.dev.vars`. Without it the endpoint answers 503.

## Hourly change detection

`src/worker.ts` adds a `scheduled` handler for the cron `0 * * * *`. It
fetches every collection from the gateway, hashes each entity, compares with
the previous manifest and, for every added, changed or deleted entity and
every entity whose publication time passed since the last run, bumps the
generation and purges the entity, collection and related tags, twice (see
above). The first run only stores a baseline. A failed source or a failed
purge aborts the run without replacing the manifest, so the next run reports
the same changes again; running twice only purges twice. The summary is logged as `content.change-detection`.

## Bindings (wrangler.jsonc)

- `API` → `platform-api-gateway`
- `CONTENT_CACHE` → KV `28d816db99f34b06b48db5fec83bc06d`
- `CF_VERSION_METADATA` (version tag on cached responses)
- `triggers.crons: ["0 * * * *"]`
- secret `CACHE_INVALIDATION_TOKEN`

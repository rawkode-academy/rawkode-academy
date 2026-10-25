# Rawkode Academy CMS

`cms.rawkode.academy`: editing for every content table in D1. Content lives in
the platform services; the CMS is a client of their write models, not a
store of its own.

```
Admin UI (browser) ─┐                    ┌─ write model per service ── D1 (rows + content_revisions)
Agents (API token) ─┴─ CMS /api/v1 ──RPC─┤
                                          └─ content-changes queue ── website worker (purges KV + CDN tags)
```

- **Write models** (`platform/<service>/write-model`, built on
  `packages/content-write`): validate every row with the service's zod
  schema, commit the change and its revision in one D1 batch, refuse stale
  writes (`ifVersion`), and send a change event naming the website cache tags
  to purge.
- **The CMS** (`src/lib/api.ts`): routes requests to the write models,
  applies roles, stores proposals, uploads media, and builds its forms from
  each write model's `describe()`.
- **The website** consumes `content-changes` and purges the tags; the hourly
  change detection stays as a safety net.

## Roles

| Role | Granted in | Writes directly | Proposes |
| --- | --- | --- | --- |
| `content_admin` | identity admin → Rawkode Academy CMS | everything; delete, restore, approve, tokens, access | — |
| `content_agent` | CMS → Settings → Tokens | technologies, videos, people, shows (+ their panels) | everything else |
| `content_guest` | identity admin, plus a CMS access link to a person | — | their own person, links, biography |
| `content_partner` | identity admin, plus a CMS access link to a technology | — | factual fields of their technology (never matrix, status, category) |

## API

`/api/v1/openapi.json` describes it. `GET /api/v1/collections` returns every
collection's fields as the write model validates them.

```bash
curl -H "Authorization: Bearer $CMS_API_TOKEN" https://cms.rawkode.academy/api/v1/collections/technologies?search=bun
curl -X PATCH -H "Authorization: Bearer $CMS_API_TOKEN" -H 'content-type: application/json' \
  -d '{"patch": {"website": "https://bun.sh"}, "ifVersion": 3}' \
  https://cms.rawkode.academy/api/v1/collections/technologies/bun
```

`422` lists invalid fields in `error.issues`; `409` is a version conflict
(`error.currentVersion`), an id that exists, or a delete refused because other
services still reference the row; `202` means the write became a proposal.

## One-time setup (in this order)

1. **Queues** (the write models and the website bind them; deploys fail
   until they exist):
   `bunx wrangler queues create content-changes && bunx wrangler queues create content-changes-dlq`
2. **CMS database**: `bunx wrangler d1 create platform-cms`, then put its id
   in `wrangler.jsonc` (`database_id` is a placeholder until then).
3. **Write models** deploy with each service's workflow on merge; the
   `content_revisions` migrations apply in the same run.
4. **Website** deploys the queue consumer on merge.
5. **Identity** deploys the `rawkode-academy-cms` client; grant yourself
   `content_admin` under the Rawkode Academy CMS application in the identity
   admin.
6. **CMS** deploys on merge (`cuenv task deploy`), then sign in at
   `https://cms.rawkode.academy`.
7. **Agent tokens**: create one per agent under Settings → Tokens (role
   `content_agent`), store each in 1Password, and set `CMS_API_TOKEN` for the
   video importer and the news agent.
8. **Backups**: `cuenv task setup` in `tasks/backup-content` creates the
   private `rawkode-academy-backups` bucket and its 90-day expiry; the nightly
   workflow `rawkode-academy-content-backup` exports every content database.

## Development

```bash
bun test          # API, roles, proposals, media and registry checks against real write models in Miniflare
bun run dev       # astro dev on :4325 (bindings from wrangler.jsonc)
```

`tests/registry.test.ts` fails when `src/lib/collections.ts` names a model,
panel, picked field or reference column that no write model defines.

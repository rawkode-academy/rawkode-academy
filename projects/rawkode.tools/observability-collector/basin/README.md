# Analytics lake (Cloudflare Basin)

First-party product analytics, replacing PostHog. Events land in Apache
Iceberg tables in the `analytics` namespace of the R2 bucket `rawkode-analytics`,
and are queried with Basin SQL (or DuckDB, Spark, anything that reads Iceberg).

```
services (CloudEvents) ─ /track ─► observability-collector ─► stream analytics_events
                                         │                      │
                                         └─► PostHog, Grafana   ├─ archive.sql ─► analytics.events_archive
                                             (until cutover)    └─ typed.sql ───► analytics.short_links, …
```

- Every event is a CloudEvent. The collector sends it to the stream whole, as
  `{ value: event }`, and to PostHog under `<source>.<type>`.
- Request context (`referrer`, `country`, `continent`) travels as CloudEvents
  extension attributes. A `useragent` extension is reduced to `device` and
  `browser`, and events from bots are dropped before PostHog or the stream see
  them.
- `analytics.events_archive` keeps every event as sent. Its pipeline never
  changes, so every other table can be rebuilt from it.
- `basin/typed.sql` turns events into typed tables, one per event family. Today
  that's `shortLink` (rawkode.link redirects) into `analytics.short_links`.
- Browser events aren't sent to the stream yet: each one moves over once it is
  defined as a CloudEvent with a typed table.

## Constraints that shape this

- The stream's only column is `value` (JSON), so it never needs replacing and
  its ID in `../wrangler.jsonc` never changes.
- Sinks and pipeline SQL **cannot be changed after creation.** Changing
  `typed.sql` replaces the typed pipeline; adding a table adds a sink. A sink
  can't be created for a table that already exists, so a table whose columns
  change needs a new name. `test/events.test.ts` checks that every field
  `typed.sql` reads is present on the event.
- `json_get_str` returns an empty string, not NULL, for a missing key.
- The Iceberg sink has no partitioning option. Queries must filter on
  `event_time`; compaction and snapshot expiry keep file counts down.

## Provisioning

`../infrastructure.cue` declares the bucket, catalog, API tokens, stream, sinks,
pipelines and the Infisical secrets. The
`rawkode-tools-observability-collector-infrastructure` workflow applies it on
merge to `main`. CI can only log in to Infisical from `main`, so pull requests
don't plan it. Changing a sink or pipeline replaces it on merge.

Before the first apply:

1. Apply `infrastructure/bootstrap` by hand. It creates CI's Infisical identity,
   its login from `main`, the folders and the state credentials, and writes the
   all-access Cloudflare token from 1Password to
   `/infrastructure/CLOUDFLARE_ROOT_TOKEN` in Infisical.
2. Set the `INFISICAL_MACHINE_IDENTITY_ID` repository secret to the new identity's
   ID.

After the first apply:

1. Set the `pipelines` binding in `../wrangler.jsonc` to the stream ID from
   `bun x wrangler pipelines streams get analytics_events`, and merge. Until
   then the collector skips the stream.
2. Run the `rawkode-tools-observability-collector-maintenance` workflow once to
   enable compaction and snapshot expiry, which the Cloudflare provider can't
   manage yet.

The website's `deploy.main` task reads `BASIN_SQL_TOKEN` from Infisical, so run
it locally with `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` set. A
deployed Worker without the token shows "not configured" on
`/internal/analytics`.

## Dual-run and cutover

`reconcile.ts` still queries the old flat `analytics.events` table, so it needs
rewriting against the new tables before it can compare anything. After that,
run it daily while both destinations are live:

```sh
cuenv task reconcile -e production   # DAYS=14 to widen the window
```

Server events must agree with PostHog within 5%. Browser events should match
or exceed PostHog: ad blockers stop posthog-js but not `/api/e`, and page views
are recorded on load rather than after PostHog's delayed init. The script also
breaks down `auth.sign_in_initiated` by bot classification and device.

Cut over after two weeks of clean reconciliation: remove the PostHog
component, the `posthog?.capture` call in `capture()`, the PostHog flush in
`src/durable-objects/data-buffer.ts`, and export PostHog history into
`analytics.events_legacy`.

## Cost

Ingress is free; at current volume (~150K events/month) everything sits inside
the Workers Paid allowances. Pipelines bills $0.04/GB transformed and $0.06/GB
written to Iceberg beyond 50 GB/month each; Basin SQL bills $2.50/TB scanned
beyond 10 GB/month; storage is $0.015/GB-month.

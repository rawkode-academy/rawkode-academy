# Analytics lake (Cloudflare Basin)

First-party product analytics, replacing PostHog. Events land in an Apache
Iceberg table, `analytics.events`, in the R2 bucket `rawkode-analytics`, and
are queried with Basin SQL (or DuckDB, Spark, anything that reads Iceberg).

```
website (browser) ─ /api/e ─ RPC ─┐
                                   ├─► observability-collector ─► stream analytics_events
services (CloudEvents) ─── /track ─┘        │                        │ pipeline.sql
                                             └─► PostHog, Grafana     ▼
                                                 (until cutover)   sink ─► analytics.events (Iceberg)
```

- **Server events** already flow through the collector's `/track`. Each one is
  written to PostHog (unchanged) and to the stream, under the same event name
  (`<source>.<type>`), so the two can be reconciled.
- **Browser events** go through `track()` / `capture()` in
  `website/src/lib/analytics/track.ts`, which beacons to the website's
  same-origin `/api/e`. The website adds user, country and user agent, and
  forwards them over its service binding to the collector's `ingestWebEvents`
  RPC method, which writes to the stream only: posthog-js still sends its own
  copy during the dual-run. There is deliberately no HTTP route for this: the
  collector is public on workers.dev, so a route would let anyone forge the
  user and request context.
- The collector owns the row schema (`src/events.ts`). Raw user agents and IPs
  are never stored: user agents are reduced to `device`, `browser` and
  `is_bot` before the row is written.

## Constraints that shape this

- The stream schema (`schema.json`), the sink and the pipeline SQL **cannot be
  changed after creation.** Rows that don't match the schema are accepted and
  then silently dropped, so `test/events.test.ts` checks every row builder
  against `schema.json`. Event-specific fields go in `properties_json` so the
  schema rarely needs to change. To change it: bump `SCHEMA_VERSION`, create a
  new stream/sink/pipeline, switch the binding, then delete the old ones.
- The Iceberg sink has no partitioning option. Queries must filter on `ts`;
  compaction and snapshot expiry keep file counts down.
- Basin SQL returns at most 10,000 rows per query and has no `OFFSET`.

## Provisioning

`../infrastructure.cue` declares the bucket, catalog, API tokens, stream, sink,
pipeline and the Infisical secrets. The
`rawkode-tools-observability-collector-infrastructure` workflow applies it on
merge to `main`. CI can only log in to Infisical from `main`, so pull requests
don't plan it. Changing the stream, sink or pipeline replaces them on merge.

Before the first apply:

1. Apply `infrastructure/bootstrap` by hand. It creates CI's Infisical identity,
   its login from `main`, the folders and the state credentials, and writes the
   all-access Cloudflare token from 1Password to
   `/infrastructure/CLOUDFLARE_ROOT_TOKEN` in Infisical.
2. Set the `INFISICAL_MACHINE_IDENTITY_ID` repository secret to the new identity's
   ID.

After the first apply:

1. Uncomment the `pipelines` binding in `../wrangler.jsonc` with the stream ID
   from `bun x wrangler pipelines streams list`, and merge. Until then the
   collector skips the stream.
2. Run the `rawkode-tools-observability-collector-maintenance` workflow once to
   enable compaction and snapshot expiry, which the Cloudflare provider can't
   manage yet.

The website's `deploy.main` task reads `BASIN_SQL_TOKEN` from Infisical, so run
it locally with `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` set. A
deployed Worker without the token shows "not configured" on
`/internal/analytics`.

## Dual-run and cutover

Run daily while both destinations are live:

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

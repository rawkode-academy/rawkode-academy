# Analytics lake (Cloudflare Basin)

First-party product analytics, replacing PostHog. Events land in an Apache
Iceberg table, `analytics.events`, in the R2 bucket `rawkode-analytics`, and
are queried with Basin SQL (or DuckDB, Spark, anything that reads Iceberg).

```
website (browser) ── /api/e ──┐
                               ├─► observability-collector ─► stream analytics_events
services (CloudEvents) ─ /track┘        │                         │ pipeline.sql
                                         └─► PostHog, Grafana       ▼
                                             (until cutover)   sink ─► analytics.events (Iceberg)
```

- **Server events** already flow through the collector's `/track`. Each one is
  written to PostHog (unchanged) and to the stream, under the same event name
  (`<source>.<type>`), so the two can be reconciled.
- **Browser events** go through `track()` / `capture()` in
  `website/src/lib/analytics/track.ts`, which beacons to the website's
  same-origin `/api/e`. The website adds user, country and user agent, and
  forwards to the collector's `/ingest`, which writes to the stream only:
  posthog-js still sends its own copy during the dual-run.
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

## Provisioning (once)

1. Create two Cloudflare API tokens and store them in 1Password
   (`sa.rawkode.academy` vault):
   - `cloudflare/api-tokens/basin-catalog`: R2 Admin Read & Write. Used by the
     sink and table maintenance.
   - `cloudflare/api-tokens/basin-sql-read`: Basin Catalog read, R2 read, Basin
     SQL read. Used by the dashboard and `reconcile`.
2. Run the `rawkode-tools-observability-collector-provision` workflow, or
   locally: `cuenv task provision -e production`.
3. Uncomment the `pipelines` binding in `../wrangler.jsonc` with the stream ID
   the script prints, and merge. Until then the collector skips the stream.
4. Add `BASIN_SQL_TOKEN` (the read token) to the website's production env in
   `website/env.cue`. The deploy script uploads it when present; without it,
   `/internal/analytics` shows "not configured".

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

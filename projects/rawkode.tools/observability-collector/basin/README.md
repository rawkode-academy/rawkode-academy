# Analytics lake (Cloudflare Basin)

First-party product analytics, replacing PostHog. Events land in Apache
Iceberg tables in the `analytics` namespace of the R2 bucket `rawkode-analytics`,
and are queried with Basin SQL (or DuckDB, Spark, anything that reads Iceberg).

## Migration goal and exit criteria

Basin becomes the complete source for Academy product analytics, and PostHog is
removed after replacement coverage and reliable delivery are demonstrated.

| Stage | Exit criterion |
| --- | --- |
| Durable delivery | Accepted events survive restarts and outages; each destination acknowledges independently; failed records are retained and replayable. |
| Browser and identity | Browser events reach the archive; anonymous/session IDs, sign-in links, logout, attribution and DNT work without PostHog cookies. |
| Typed tables and reporting | Event-family tables and replayable backfills support the existing traffic, growth, video, authentication and game reporting. |
| Operational telemetry | Logs, metrics, exceptions and tail events have a verified replacement destination and retention policy. |
| Production validation | Fourteen consecutive healthy days: accepted-to-archive checks, ID-based reconciliation, deduplication, identity/funnel checks, and outage recovery. |
| Retirement | Stop PostHog delivery behind a rollback switch, preserve required history, then remove SDKs, secrets, bindings, cookies and obsolete docs. |

Cutover is gated by evidence, not the merge date. The current count-only
reconciliation is insufficient to approve retiring PostHog by itself.

### Progress recorded 13 November 2026

- Durable delivery: PR #1600, verified locally with restart/outage tests; production
  validation and required GitHub review remain outstanding until merged/deployed.
- Browser ingestion: versioned normalization, trusted context, bounded bodies,
  durable acknowledgement, retries preserving IDs, first-party identity and logout
  reset are implemented for review. Query strings and sensitive property fields
  are stripped; DNT is checked on client and server. Browser delivery on unload
  remains best effort, and loss before durable acceptance is outside the server
  delivery guarantee.
- Next: complete attribution independence, add typed browser/event-family tables,
  deduplicate archive/typed reporting, and establish production validation evidence.
- The fourteen-day production validation window has not started.

## Delivery operations

The collector persists a separate pending entry for Basin, PostHog and configured
Grafana delivery before acknowledging an event. New CloudEvents use 16 fixed
buffer shards; legacy array buffers are adopted atomically on their next alarm.
Every destination is acknowledged independently. HTTP failures and timeouts
retain work, with exponential retry and individual retries after batch failure.
After 12 failed attempts, records move to retained failed storage; they are never
silently discarded. This is at-least-once delivery: the archive and typed-table
queries must deduplicate CloudEvents by `(source, id)` before cutover. PostHog
receives a stable `$insert_id` derived from these fields.

Structured `analytics.delivery.status`, `.retry` and `.failed` logs provide
per-destination counters and retry/failed signals. The collector's internal RPC
`deliveryStatus()` reports each current and legacy buffer. After correcting a
destination failure, `replayFailed(bufferName, destination)` requeues up to 25
failed entries with their original payloads. Repeat while the reported failed
count is nonzero. Neither operation is exposed on the public HTTP router.
Failed storage has no automatic expiry; monitor its count and provision alerts
before declaring this stage validated in production.


### Producer acknowledgement — 14 November 2026

PRs #1600 and #1601 remain merged/deployed; #1602, #1603 and #1604 have green
checks and protected auto-merge enabled, but GitHub still requires review. This
bounded follow-up fixes a separate acceptance gap: website domain/identity
producers previously ignored non-OK HTTP responses, and storage failures were
reported as non-retryable 400 responses.

`/track` now returns a version-1 receipt with CloudEvent source/ID and disposition
only after the durable buffer accepts the event. Bot filtering returns a separate
`filtered` disposition. Invalid requests remain 400, forged browser sources
remain 403, and acceptance/storage failures return sanitized 503 responses.
Validation/storage logs omit raw event payloads and exception bodies.

Website producers serialize once and retry transient/network/ambiguous failures
at most three times with the original source, ID and timestamp. Each attempt,
including receipt-body reading, is limited to 600 ms within a 2-second total
budget per producer call. Receipt bodies are bounded to 8 KiB. Permanent errors
and redirects are not retried or followed. A matching receipt is required to
report `accepted`; an old success-only response remains `unconfirmed`. Collector
and website deploy independently: verify the collector protocol first, and
expect bounded unconfirmed outcomes/duplicate IDs during deployment skew. Always
deduplicate by `(source, id)` as implemented in #1602.

Both `captureServerEvent` and `identifyServerUser` return an explicit delivery
outcome. Their existing callers continue the business action on telemetry
failure; failures are observable through `analytics.producer.failed`, while
`analytics.producer.acknowledged` includes only event source/ID, disposition and
attempt count. Logs omit event/profile contents and response/error bodies. Login
linkage carries only opaque user/anonymous IDs, omits email/name profile copies,
and skips anonymous linkage when the request sends DNT. First-party cookie
ownership and broader cookie/DNT independence remain covered by #1603.

Validation: 29 collector tests, 62 focused website tests, strict collector and
website producer/source/test TypeScript checks. A real workerd test over HTTP
service bindings injected a Durable Object rejection, verified retry with the
same ID and a matching persistence receipt, and found exactly one pending event
per destination. Unit tests cover acknowledgement ordering, invalid/forged
requests, filtering, retries, receipt identity mismatch, hung bindings/streams,
oversized receipts, missing bindings, permanent errors and safe logs. Required
`cuenv sync -A` was attempted; local CUE registry access remains forbidden.

This is **not a producer outbox**: a process/request can still end before durable
acceptance or after bounded retry exhaustion. Logs are not a durable acceptance
ledger and their production sampling/retention/completeness is unverified. No
live Basin SQL, producer-to-archive proof, linked-person report, outage/replay
production result or fourteen-day healthy window is claimed. PostHog stays on;
all-family typed reporting, durable producer failure recovery, production
identity evidence and operational telemetry replacement remain outstanding.


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
- Browser batches become schema-v1 CloudEvents under source
  `rawkode-academy-browser` and type `web.<event>`. They reach the archive
  through the same durable delivery path. Typed browser tables and dashboard
  panels remain a later migration stage.

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
pipelines and the Infisical secrets. Pull requests that change it get a plan as
a comment, made with read-only credentials; the
`rawkode-tools-observability-collector-infrastructure-apply` workflow applies it
on merge to `main`. Changing a sink or pipeline replaces it.

Compaction and snapshot expiry aren't in the Cloudflare provider, so
`maintenance.sh` sets them through the catalog API. The
`rawkode-tools-observability-collector-maintenance` workflow runs it on `main`
whenever the script or the infrastructure changes, which stores a rotated
catalog token again, and it can be run by hand.

Before the first apply, apply `infrastructure/bootstrap` by hand. It creates
CI's Infisical identities and their logins, the folders, the state credentials
and the repository variables that name the identities, and writes the
Cloudflare tokens to Infisical.

After the first apply, set the `pipelines` binding in `../wrangler.jsonc` to the
stream ID from `bun x wrangler pipelines streams get analytics_events`, and
merge. Until then Basin deliveries remain pending and retry, rather than being acknowledged.

The website's `deploy.main` task reads `BASIN_SQL_TOKEN` from Infisical, so run
it locally with `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` set. A
deployed Worker without the token shows "not configured" on
`/internal/analytics`.

## Dual-run and cutover

`reconcile.ts` compares daily CloudEvent counts from `analytics.events_archive`
with PostHog events written by the collector (`$lib = observability-collector`
and `cloudevents_id` present). It reconstructs PostHog names as
`<event_source>.<event_type>`, groups by `event_time` in UTC, and skips the
partial first day using the archive's earliest `__ingest_ts`.

```sh
cuenv task reconcile -e production   # DAYS=14 to widen the window (1–90)
```

Counts must agree within 5% (with an absolute slack of two events per day).
Missing Basin days fail the check. Browser CloudEvents are included once ingestion is deployed; browser SDK-only
PostHog events, OTLP logs and metrics are outside this comparison; a clean result does not validate browser migration.

The internal website dashboard queries CloudEvents in `events_archive` for
server event totals, sign-in events, newsletter submissions and video engagement.
Matched redirects come from `short_links`. Counts are events, not deduplicated
people or attributed funnels. Viewer estimates exclude missing and anonymous
IDs. Browser traffic, referrers, campaigns and CTA impressions/clicks are marked
unavailable until typed browser reporting is migrated. There is no stored bot total:
known bots are filtered at ingestion and missing classification is not proof of
a human visitor.

The empty legacy `analytics.events` table is no longer queried. To purge it,
run the guarded one-time cleanup task with Infisical access:

```sh
cuenv task drop-legacy-table -e production
```

The task refuses deletion if a sink names it, the table is nonempty, or the
namespace contains unexpected tables. It uses the catalog write token without
printing it, requests purge, then verifies the surviving tables and their
maintenance settings. Purging is irreversible.

Cut over after browser ingestion is migrated and two weeks of clean reconciliation: remove the PostHog
component, the `posthog?.capture` call in `capture()`, the PostHog flush in
`src/durable-objects/data-buffer.ts`, and export PostHog history into
`analytics.events_legacy`.

## Cost

Ingress is free; at current volume (~150K events/month) everything sits inside
the Workers Paid allowances. Pipelines bills $0.04/GB transformed and $0.06/GB
written to Iceberg beyond 50 GB/month each; Basin SQL bills $2.50/TB scanned
beyond 10 GB/month; storage is $0.015/GB-month.

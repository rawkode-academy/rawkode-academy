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

`reconcile.ts` compares exact daily `(source, id)` sets in the archive with
collector CloudEvents in PostHog (`$lib = observability-collector` and
`cloudevents_id` present). It checks canonical event names and identities reused
on different days. Extra physical deliveries are reported separately rather
than inflating event totals. Matching counts with different IDs fail.

```sh
cuenv task reconcile -e production
# Optional controls: DAYS=14 SETTLE_HOURS=6 RECONCILE_REPORT=./delivery-parity.json
```

Days use UTC and exclude the partial first ingestion day. A six-hour grace
period defers checking yesterday until 06:00 UTC (`SETTLE_HOURS`, 0–48). Both
providers are read with ordered 1,000-row keyset pages, with at most 100,000
identities per day; malformed, repeated, unordered or truncated pages fail rather
than produce a partial success. Late arrivals still require repeated checks of
settled days; cross-provider reads are not a shared snapshot.

Exit 0 means ID parity for all examined days; 1 means mismatch or an empty day;
2 means no full settled day was eligible. Query/authentication failures also
fail the command. `RECONCILE_REPORT` optionally saves a private JSON receipt
containing generation time, UTC window, source coverage, duplicate counts and
daily differences. Receipts deliberately set `cutover_ready: false`: ID parity
does not prove producer acceptance, payload equality, complete event-family
coverage, identity stitching, dashboard correctness or operational telemetry.
Browser CloudEvents are included; browser SDK-only PostHog events and OTLP
telemetry are outside this comparison.

The internal website dashboard queries CloudEvents in `events_archive` for
server event totals, sign-in events, newsletter submissions and video engagement.
Matched redirects come from `short_links`. Archive aggregations select the
first ingested copy per `(event_source, event_id)` before counting. The original
short-links schema lacks source, so its deduplication uses the rawkode-link
producer's globally generated UUID `event_id`. Missing event identities are
excluded from business totals and exposed as data-quality failures; repeated
delivery counts are also visible. A future typed-table revision must retain
source so this narrower scope can be removed. Counts are events, not deduplicated
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

## Scheduled ID-parity evidence — 14 November 2026

The reconciliation PR now includes a daily read-only evidence pipeline at 06:30
UTC and a manual workflow, `rawkode-tools-observability-collector-evidence`.
It reuses the existing production CI Infisical identity for `BASIN_SQL_TOKEN`
and 1Password service account for the PostHog query key. No secret value is
copied into this runner, repository, report or workflow input. Existing GitHub
production-environment protections remain in place. The query wrapper only runs
for scheduled/manual events on this repository's `main`; feature/PR execution
fails before provider queries. Do not dispatch the workflow against a feature
branch to bypass pending review.

Each run invokes the exact-ID reconciliation for only the latest eligible full
UTC day with six hours of settlement. The child process is limited to two
minutes, and its raw stdout/stderr is discarded. Its receipt is written inside
a mode-0700 temporary directory, read with a 1 MiB bound, checked for freshness,
scope, window alignment, safe counters, source totals, pass/exit consistency and
`cutover_ready: false`, then deleted. CI logs contain only allowlisted aggregate
counters, source count (not source strings or event IDs), commit SHA and workflow
link. There is no public raw-data artifact or cutover action. A missing, stale,
malformed, contradictory or empty receipt never becomes a successful result.
Errors report only the internal stage: context, credentials, provider queries or
receipt validation; provider response/error text is never forwarded.

After this PR merges, dispatch the existing workflow on `main` and inspect its
run result. A failure in credential setup identifies the CI identity/provider
configuration to fix; a query-stage failure needs provider access/query review.
Do not paste credential values into chat. The current runner still lacks Basin
SQL/Infisical credentials, and no live provider result is claimed before this
workflow has run after merge. On this run #1602–#1605 remain review-blocked; their
existing CI was green. Main remains `922fda0198911725f60f8c1f4b66219b5d76d791`.

Offline validation: 41 collector tests, including real subprocess boundaries
that deliberately emit fake secrets on both child streams and confirm they never
reach parent logs, plus failed/malformed/missing receipts, private-file cleanup,
feature-branch rejection and aggregate-only serialization. Strict collector and
new evidence-tool/test TypeScript checks pass. Local `cuenv sync -A` was attempted
but the CUE registry returns Forbidden; generated-file validation remains required
in CI. No new lake resources, secrets, permissions or PostHog cutover are created.

A green evidence job means **collector source/ID/type parity for that day only**.
It does not prove producer acceptance, payload equality, all required event-family
coverage, identity linkage, reporting, Grafana/operational telemetry or outage
recovery. It must not start or satisfy the fourteen-day all-family cutover window
by itself. The fourteen-day production window has not started; PostHog stays on.

## Cost

Ingress is free; at current volume (~150K events/month) everything sits inside
the Workers Paid allowances. Pipelines bills $0.04/GB transformed and $0.06/GB
written to Iceberg beyond 50 GB/month each; Basin SQL bills $2.50/TB scanned
beyond 10 GB/month; storage is $0.015/GB-month.

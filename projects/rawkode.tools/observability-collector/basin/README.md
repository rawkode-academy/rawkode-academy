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

### Browser table stage — 14 November 2026

PRs #1600 and #1601 are merged and their collector/website deployment workflows
succeeded. PRs #1602 (deduplication/exact-ID comparison) and #1603 (first-party
attribution) have green checks with protected auto-merge enabled, but required
review still blocks them. The fourteen-day all-family production window has not
started; deployment success alone is not healthy-delivery evidence.

`browser.sql` adds a separate `analytics_browser_v1` pipeline and
`analytics_browser_events_v1` sink for `analytics.browser_events_v1`. Existing
archive/short-link SQL, sinks, stream identity and bindings are preserved. Only
source `rawkode-academy-browser`, `web.*` events and numeric schema version 1 in
both envelope and data are routed. The table projects source/ID, event time,
anonymous/session/authenticated identity, page/referrer dimensions, geography,
device/browser and current/first/last campaign fields. Optional strings are empty
when absent. It stores normalized fields rather than raw URLs or headers.
First/last attribution is sparse until #1603 is deployed; absent values are not
proof of direct traffic. Schema changes require a new versioned sink/table.

The read-only `browser-report` task compares every projected field and source/ID
against the same projection of the archive using bidirectional set differences.
It rejects missing/substituted identities, changed attribution, conflicting
same-ID projections, invalid anonymous/session identities and empty evidence.
Identical repeated deliveries are allowed. Both the full window and each UTC
day must pass, so busy days cannot hide missing days or cross-day ID conflicts.
Only after parity passes does it produce deduplicated traffic, page/referrer and
first/last campaign reports. Anonymous visitor estimates, sessions and distinct
authenticated users are separate measurements, not a linked-person funnel.

After confirming the new table's first flush and maintenance settings, choose
full UTC days after deployment (or a separately verified backfill), ending at
least six hours ago. Use 1–31 days per report:

```sh
BROWSER_START=YYYY-MM-DD BROWSER_END=YYYY-MM-DD BROWSER_REPORT=/private/browser-report.json \
  cuenv task browser-report -e production
```

`BROWSER_END` is exclusive. Exit 0 means projection parity only; exit 1 means
failed/empty evidence and exit 2 means a query, access or output error. Invalid
configuration also exits nonzero. Output files use mode 0600, refuse overwrite
and contain event dimensions; store them privately. No replay, backfill or
PostHog cutover occurs. Reports always record `cutover_ready: false`. The website
dashboard remains unchanged until live typed reporting is verified.

Offline validation: 28 collector tests, 56 focused website tests, strict
collector/browser-tool TypeScript and all four SQL queries executed in DuckDB
with JSON/timestamp compatibility adapters. Fixtures cover routing, sparse
fields, duplicates, attribution corruption with equal IDs/counts, conflicting
IDs, invalid sessions and missing typed rows. This is not live Basin execution.
`cuenv sync -A` was attempted; the runner's CUE registry fetch is forbidden.
Basin SQL/Infisical credentials remain unavailable, so no live parity result,
backfill or legacy purge is claimed. The guarded purge now permits only the
explicitly declared browser table as an optional additional survivor, verifies
its maintenance when present and still refuses all unexpected/undeclared tables.

Live catalog verification on 14 November 2026 confirmed `events_archive` and
`short_links` still have compaction enabled (128 MB target) and snapshot expiry
enabled (7 days, keep 10). The namespace still contains the empty-table cleanup
target `events`; no purge was attempted. The initial CI plan for `9d4b1ed`
showed exactly two browser resources to create and eleven unchanged, with no
replacements/deletions (run `43537387432`). CI also reported four generated
workflow path additions for `browser.sql`; those exact changes are committed.
Refresh the plan/checks against the current final commit before merging.
After merge, verify infrastructure apply, the new table/schema, catalog and
per-table compaction/snapshot expiry, sink error metrics and production SQL
compatibility. Archive history before the new pipeline is not automatically
backfilled. Typed server/video/game families, dashboard wiring, replayable
backfills, producer acceptance, login linkage and operational telemetry coverage
remain work. Do not retire PostHog before fourteen consecutive healthy production
days covering those requirements and outage/replay validation.

### Guarded legacy cleanup in CI — 14 November 2026

The already-authorized empty `analytics.events` purge now has a **manual-only**
production workflow, `rawkode-tools-observability-collector-legacy-cleanup`.
It invokes the existing `drop-legacy-table` task with its existing Infisical
catalog-write credential. There is no push or scheduled deletion trigger. The
task itself rejects GitHub runs unless the repository matches, the ref is
`refs/heads/main`, and the event is `workflow_dispatch`. Explicit task-environment
passthrough preserves those checks when cuenv clears inherited task variables.
Local authorized operators can still run the existing guarded task.

After this PR merges and infrastructure apply/table creation is stable, dispatch
that workflow on `main`. Do not run it on a feature branch to bypass review. The
task freshly lists the namespace, checks sink declarations, proves no current
snapshot/history or zero current records, requests purge, then verifies every
survivor and its compaction/snapshot-expiry settings. The versioned browser table
is only allowed when its sink is explicitly declared. Unknown tables, nonempty
metadata, sink references, disabled maintenance and inexact snapshot IDs stop
before deletion. Decimal snapshot IDs are reported losslessly; unsafe numeric
IDs require review instead of guessing their value.

Each catalog request has a 30-second deadline. Transport and malformed-response
errors omit raw response/error content and credentials. If a request fails after
the purge starts, deletion may already have completed: inspect the recorded
pre-drop snapshot/record count and re-list the catalog before reporting or
retrying. The task is idempotent when the legacy table is already absent, and it
still verifies survivor maintenance in that case. Never claim the table remains
present merely because a post-drop verification failed.

No production cleanup was dispatched in this implementation run. The legacy
table remains pending review and execution on merged main; no deletion result is
claimed. Current main remains `922fda0198911725f60f8c1f4b66219b5d76d791`, and migration
PRs #1602–#1605 still require review. Validation: 60 focused website tests,
including manual-main CI acceptance, automatic/feature CI rejection, response
redaction, nonempty-table refusal, maintenance and exact-snapshot guards; strict
browser-tool TypeScript and browser SQL/CLI fixture checks pass. The 28 collector tests also pass. Local `cuenv sync -A` was attempted but CUE
registry access is forbidden; generated workflow equality must pass in CI.
PostHog and the fourteen-day cutover gate are unchanged.

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

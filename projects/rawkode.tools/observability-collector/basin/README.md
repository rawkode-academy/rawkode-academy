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
- Request context (`referrer`, `country`, `continent`, `asn`) travels as
  CloudEvents extension attributes. A `useragent` extension is reduced to
  `device` and `browser`; the raw string is never stored.
- Bot traffic is stored and labelled, never dropped. Every event with request
  context carries `bot` (true/false) and, for bots, `botreason`: the rule that
  matched (`hosting-asn`, `ua-pattern`, `non-browser-ua`, `desktop-no-browser`
  from the collector; `non-production`, `spoofed-chrome`, `headless`,
  `webdriver`, `cf-verified-bot`, `cf-bot-score` from the website;
  `unmatched-path` from rawkode.link). Queries exclude bots; see
  `HUMAN` and `LINK_HUMAN` in the website's `src/lib/analytics/queries.ts`.
- `analytics.events_archive` keeps every event as sent. Its pipeline never
  changes, so every other table can be rebuilt from it.
- `basin/typed.sql` turns events into typed tables, one per event family. Today
  that's `shortLink` (rawkode.link redirects) into
  `analytics.short_link_redirects`, which has `bot`, `bot_reason` and `asn`
  columns. Redirects before 23 November 2026 stay in `analytics.short_links`,
  which no pipeline writes to any more.
- Browser batches become schema-v1 CloudEvents under source
  `rawkode-academy-browser` and type `web.<event>`. They reach the archive
  through the same durable delivery path. `typed.sql` also writes the browser
  families PostHog's SDK used to collect on its own into typed tables:
  `web_page_views`, `web_clicks` (`web.click`, `web.dead_click`,
  `web.rage_click` in `kind`), `web_page_leaves` (`time_on_page_ms`,
  `max_scroll_pct`), `web_exceptions` (stack up to 4 KB) and `web_vitals`
  (`metric`, `metric_value`). Delivery is at-least-once: deduplicate on
  `event_id`. Typed tables start empty on the day their pipeline is created;
  the archive holds everything since 13 November 2026.
- Identity: browser events carry `data.anonymous_id` (the `rk_aid` cookie) and,
  when signed in, `data.user_id`. Sign-in also sends
  `rawkode-academy-website` / `user.identified` with `data.distinct_id` (the
  user) and `data.anon_id`. Every anonymous ID of one user:

  ```sql
  SELECT DISTINCT json_get_str(value, 'data', 'anon_id') AS anonymous_id
  FROM analytics.events_archive
  WHERE event_type = 'user.identified'
    AND json_get_str(value, 'data', 'distinct_id') = '<user id>'
    AND event_time >= CAST('2026-11-07T00:00:00Z' AS TIMESTAMP)
  ```

  Browser events signed in with that user add the rest
  (`data.user_id = '<user id>'`, select `data.anonymous_id`). Before
  24 November 2026 `user.identified` also carried the user's email and name in
  `data.set_properties`; it no longer does.

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
Matched redirects come from `short_links` and `short_link_redirects`. Counts are events, not deduplicated
people or attributed funnels. Viewer estimates exclude missing and anonymous
IDs. Browser traffic, referrers, campaigns and CTA impressions/clicks are marked
unavailable until typed browser reporting is migrated. Every query
excludes bots. Events stored before labelling are labelled at query time from
the signals they kept (host, the old user-agent verdict, device and browser);
hosting networks, client hints and webdriver weren't stored, so older events
from those bots still count as people.

To write those labels into the stored rows, run the one-time relabel task
after this change is deployed (so nothing new is written to `short_links`):

```sh
cuenv task relabel-history -e production            # dry run: counts per reason
RELABEL_ARGS=--apply cuenv task relabel-history -e production # rewrite in place
```

It rewrites only rows ingested before it starts, adds `bot`, `botreason` and
`botbackfill` to archive events, and adds `bot`, `bot_reason` and `asn`
columns to `short_links`. Rows already labelled are kept, so it is safe to
re-run. Each table's previous snapshot ID is printed; within the 7-day
snapshot expiry, `RELABEL_ARGS="--rollback <table> <snapshot-id>"` restores it (and drops
anything appended since). The query-time rules stay, so the dashboard is
correct before and after the rewrite.

The task needs only Nix: the project's `flake.nix` provides Python with
PyIceberg, pyiceberg-core and PyArrow, so it works the same on NixOS, macOS
and CI.

Sign-ins before PR #1646 wrote the user's email and name into
`user.identified` events (`data.set_properties`). After #1646 is deployed,
remove them, and any other email address in stored events, with the one-time
scrub task:

```sh
cuenv task scrub-pii -e production                       # dry run: counts per field
SCRUB_ARGS=--apply cuenv task scrub-pii -e production    # rewrite in place
SCRUB_ARGS="--rollback <snapshot-id>" cuenv task scrub-pii -e production
```

From CI (main): the manual workflows
`rawkode-tools-observability-collector-scrub-pii` (dry run) and
`rawkode-tools-observability-collector-scrub-pii-apply`.

It rewrites only rows ingested before it starts and keeps `distinct_id` and
`anon_id`, so identity links survive. Re-runs change nothing. The previous
snapshot, printed on apply, still holds the data until snapshot expiry
(7 days); rolling back restores it.

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
component, the `posthog?.capture` call in `capture()` and the PostHog flush in
`src/durable-objects/data-buffer.ts`. PostHog history is already in
`events_archive` (below).

### PostHog history in `events_archive`

PostHog project 12084 was imported once, on 25 November 2026, into
`analytics.events_archive`: 124,800 events from 1 December 2023 up to each
family's cutoff (server events 7 November 2026, browser `capture()`/`track()`
events 13 November 2026, SDK-only events like `$pageleave` 24 November 2026
16:14 UTC). Names were mapped from the bare, `rawkode.academy.*`,
`com.rawkode.academy.*`, `/<service>.*` and `<source>.<type>` schemes to
today's source and type. Imported rows carry `botbackfill: "posthog-import"`
and `data.posthog` (PostHog UUID, event name, distinct ID, person ID, cleaned
properties). Their `__ingest_ts` is the import time.

Not imported: `$autocapture`; every `link.redirect` spelling (~1.4M scanner
hits); operational and PostHog-internal events; test events; localhost and
preview hosts; and the July 2025 ad-network spike. The importer is not kept
in the repository.

Charting December 2023 to today in one query (Basin SQL):

```sql
SELECT date_trunc('month', event_time) AS month, event_source, event_type, count(*) AS events
FROM analytics.events_archive
WHERE event_time >= CAST('2023-12-01T00:00:00Z' AS TIMESTAMP)
	AND coalesce(json_get_bool(value, 'bot'), false) = false
	AND (
		(event_source = 'rawkode-academy-browser' AND event_type = 'web.page_view')
		OR (event_source = 'rawkode-academy-website' AND event_type = 'video.play')
		OR (event_source = 'rawkode-academy-identity' AND event_type = 'auth.user_registered')
		OR (event_source = 'platform-email-preferences-rpc' AND event_type = 'email.subscribed')
	)
GROUP BY 1, 2, 3
ORDER BY 1
```

## Cost

Ingress is free; at current volume (~150K events/month) everything sits inside
the Workers Paid allowances. Pipelines bills $0.04/GB transformed and $0.06/GB
written to Iceberg beyond 50 GB/month each; Basin SQL bills $2.50/TB scanned
beyond 10 GB/month; storage is $0.015/GB-month.

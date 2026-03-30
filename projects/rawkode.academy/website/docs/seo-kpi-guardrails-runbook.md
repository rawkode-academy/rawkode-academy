# SEO KPI Dashboard And Alert Guardrails Runbook

Last updated: 2026-03-26 (UTC)
PostHog project: `12084` (Rawkode Academy)

## Scope

This runbook defines KPI formulas, owners, thresholds, and incident handling for SEO observability.
It is intentionally scoped to Wave 2 KPI/guardrail operations and does not overlap planning docs.

## Assets

- Dashboard: `Content & SEO` (`272837`)
- Required KPI insights on dashboard:
  - `Canonical traffic baseline (30d + 90d)` (`1475844`)
  - `Organic traffic by search engine (30d)` (`1475843`)
  - `Watch-page organic entries (30d)` (`1475837`)
  - `Indexed video page traffic proxy (30d)` (`3665376`)
  - `CTR proxy events (30d)` (`3665379`)
  - `Conversion proxy (30d)` (`3665380`)
  - `Guardrail severe-drop events (90d)` (`3665387`)
- Alert path action:
  - `SEO Severe Drop Guardrail` (`126042`)
  - Trigger event: `seo.kpi.severe_drop`

## Owners

- KPI Owner: David Flanagan (`david@rawkode.academy`)
- Incident Commander (SEO KPI regressions): David Flanagan
- Backup owner: unassigned (set in next ops review)

## KPI Definitions

| KPI | Formula |
| --- | --- |
| Total pageviews | `countIf(event='page_view' AND properties.$host='rawkode.academy')` |
| Organic pageviews | `countIf(page_view AND $search_engine is set)` |
| Organic watch-page entries | `countIf(page_view AND path like '/watch/%' AND $search_engine is set)` |
| Indexed video page traffic proxy | `countDistinctIf(path, page_view AND path like '/watch/%' AND $search_engine is set)` |
| CTR proxy events | `countIf(event='$autocapture' AND $session_entry_search_engine is set)` |
| Conversion proxy | `newsletter_signups + account_signups` where `newsletter_signups = countIf(event='platform-email-preferences-rpc.email.subscribed')` and `account_signups = countIf(event='rawkode-academy-identity.auth.user_registered')` |

## Guardrail Thresholds

| Signal | Threshold | Severity | Alert Event Payload |
| --- | --- | --- | --- |
| Total pageviews drop | 7d value down `>=30%` vs previous 7d baseline | Critical | `seo.kpi.severe_drop` with `kpi=total_pageviews` |
| Organic pageviews drop | 7d value down `>=30%` vs previous 7d baseline | Critical | `seo.kpi.severe_drop` with `kpi=organic_pageviews` |
| Indexed video proxy regression | 30d distinct indexed watch pages down `>=40%` or absolute `<5` | High | `seo.kpi.severe_drop` with `kpi=indexed_video_pages_with_organic_traffic` |
| Conversion proxy regression | 30d conversion proxy down `>=35%` vs previous 30d | High | `seo.kpi.severe_drop` with `kpi=conversion_proxy_total` |

## Tested Alert Path

Configured path:

- Action `126042` posts to Slack when `seo.kpi.severe_drop` is ingested.
- Slack message includes `kpi`, `window`, `delta_pct`, `observed`, `baseline`.

Test executed on 2026-03-26:

- Test event ingested via PostHog capture API.
- Latest test payload evidence:
  - `timestamp`: `2026-03-26T10:23:56.672000Z`
  - `kpi`: `total_pageviews`
  - `window`: `7d`
  - `delta_pct`: `-42.5`
  - `observed`: `175`
  - `baseline`: `304`
- Guardrail insight `3665387` confirms `severe_drop_events_90d = 1`.

## 7d/30d/90d Evidence Snapshot

Measured on 2026-03-26 (UTC):

| Window | Total pageviews | Organic pageviews | Organic watch entries | Indexed video pages (organic) | CTR proxy events | Newsletter signups | Account signups | Conversion proxy total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 7d | 175 | 109 | 2 | 2 | 53 | 4 | 4 | 8 |
| 30d | 600 | 232 | 8 | 8 | 259 | 5 | 4 | 9 |
| 90d | 1016 | 337 | 12 | 12 | 364 | 35 | 37 | 72 |

## Freshness Checks

Latest ingested timestamps:

- `latest_pageview_at`: `2026-03-25T23:23:28.499000Z`
- `latest_organic_pageview_at`: `2026-03-25T23:23:28.499000Z`
- `latest_organic_watch_entry_at`: `2026-03-20T03:38:51.149000Z`
- `latest_ctr_proxy_event_at`: `2026-03-25T23:20:13.667000Z`
- `latest_newsletter_signup_at`: `2026-03-21T09:16:18.922000Z`
- `latest_account_signup_at`: `2026-03-22T11:43:42.003000Z`

## Incident Runbook

1. Confirm guardrail event context in insight `3665387` and inspect payload fields (`kpi`, `window`, `delta_pct`, `observed`, `baseline`).
2. Open dashboard `272837` and verify impacted KPI tile against 7d/30d/90d snapshot.
3. Check acquisition mix changes in `Organic traffic by search engine (30d)` (`1475843`).
4. If watch/index KPI is impacted, inspect `Watch-page organic entries (30d)` (`1475837`) and `Indexed video page traffic proxy (30d)` (`3665376`).
5. If conversion KPI is impacted, inspect `Conversion proxy (30d)` (`3665380`) and newsletter/account source systems.
6. Create incident note with timestamp, suspected cause, and remediation owner.
7. Post-incident: update thresholds if false positives/negatives are observed.

## Operational Notes

- Native PostHog threshold-alert API requires personal API key scopes not available in this automation context; action-based guardrail eventing is used here and verified end-to-end via ingestion test.
- If personal alert API access is later available, add absolute/relative threshold alerts directly on KPI insights and keep this runbook thresholds synchronized.

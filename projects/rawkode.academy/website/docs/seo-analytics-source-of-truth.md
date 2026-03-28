# SEO Analytics Source of Truth

This document defines the canonical pageview event and property mapping for SEO reporting in Rawkode Academy PostHog project `12084`.

## Canonical Event

- Use `page_view` as the source of truth for active website SEO reporting.
- The event is emitted explicitly in `src/components/posthog/index.astro` after consent.
- PostHog automatic pageview capture is disabled with `capture_pageview: false`, so `page_view` is the intentional website baseline.

## Legacy Event Policy

- Treat `$pageview` as a legacy comparison event only.
- Do not sum `page_view` and `$pageview` in KPI tiles.
- The two events overlap in project `12084`, so merging them would double count traffic during the transition period.
- Keep `$pageview` only for historical audits or older queries when `page_view` is absent for the requested date range.

As of March 26, 2026:

- `page_view` is the active reporting baseline for the last 30 and 90 days.
- `$pageview` was still present through March 4, 2026, so mixed-event dashboards were inflating or distorting comparisons.

## Canonical Property Mapping

| Reporting field | Canonical source | Legacy fallback | Notes |
| --- | --- | --- | --- |
| Pageview count | `event = 'page_view'` | `$pageview` | Use `page_view` for SEO dashboards. |
| Path | `properties.path` | `properties.$pathname` | Saved queries coalesce `path` first, then `$pathname`. |
| Referrer URL | `properties.referrer` | `properties.$referrer` | Use URL only when domain-level attribution is insufficient. |
| Referrer domain | `properties.$referring_domain` | derive from referrer URL if needed | Saved queries normalize `www.` away and preserve `$direct`. |
| Search engine | `properties.$search_engine` | none | Canonical organic traffic attribution. |
| Session | `$session_id` | none | Used for traffic baseline tables and trend tiles. |
| User | `person_id` | none | Use PostHog person identity for unique-user reporting. |

## Dashboard Baseline

The saved SEO baseline now lives on dashboard `272837` (`Content & SEO`):

- Insight `1475844`: `Canonical traffic baseline (30d + 90d)`
- Insight `1475843`: `Organic traffic by search engine (30d)`
- Insight `1475842`: `Top landing paths (30d)`
- Insight `1475841`: `Top referrers (30d)`
- Insight `1475837`: `Watch-page organic entries (30d)`

The main growth traffic trend on dashboard `272690` (`Growth North Star`) is also aligned:

- Insight `1475332`: `Daily traffic: Pageviews, DAU, Sessions (90d)`

## Query Rules

- Filter website traffic to `properties.$host = 'rawkode.academy'`.
- For landing-path reporting, exclude internal referrers where normalized `properties.$referring_domain = 'rawkode.academy'`.
- For watch-page SEO reporting, filter canonical paths with `LIKE '/watch/%'`.
- For organic traffic reporting, require `properties.$search_engine` to be present.

## Migration Rule

When creating or editing PostHog insights for SEO:

1. Start with `page_view`.
2. Use the canonical property mapping above.
3. Only reach for `$pageview` if the requested historical window has no `page_view` coverage.
4. Record any exception in the dashboard or insight description so mixed-source reporting does not silently return.

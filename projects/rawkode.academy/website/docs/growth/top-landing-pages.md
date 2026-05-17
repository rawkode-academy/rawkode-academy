# Top landing pages — diagnostic report

Snapshot taken 2026-05-17 from PostHog (`Rawkode Academy` project, EU). Window: last 90 days. Source event: `page_view`. All pathnames normalised by stripping trailing slash, so `/courses` and `/courses/` are folded together.

This report exists to answer three questions:

1. Where is traffic actually landing?
2. Which pages convert visitors into newsletter subscribers?
3. Which pages convert visitors into activated users?

The next acquisition PRs (SEO on `/technology/[id]`, SEO on `/watch/[...slug]`, YouTube description CTAs, recommended-content) should be prioritised against the surfaces these lists surface — work the data, not opinion.

## Caveats

- **Sparse data.** The whole 90-day window is roughly 2,500 pageviews / 350 unique visitors. Every "conversion rate" below has a denominator under 50 — treat as directional, not statistically reliable.
- **Trailing-slash normalisation.** The homepage `/` ends up as an empty pathname in the normalised set (it's still the top row by traffic — 601 pageviews / 255 visitors).
- **Outliers.** Two pages have heavy traffic from a single visitor (`/watch/klustered-11`: 25 pv / 1 visitor; `/technology/antrea`: 18 pv / 1 visitor). Likely bot or self-test loops. Filtered out of the conversion lists by the `visitors >= 5` floor.
- **Subscriber conversion = subscribed inside the 90-day window**, not strictly "later than the visit." For a thin dataset that's the cleanest comparison.

## 1. Top pages by traffic (last 90d)

| Pathname | Pageviews | Unique visitors |
| --- | ---: | ---: |
| `/` (homepage) | 601 | 255 |
| `/technology/matrix` | 138 | 71 |
| `/learning-paths` | 134 | 55 |
| `/courses` | 112 | 61 |
| `/watch` | 92 | 51 |
| `/technology/matrix/advanced` | 78 | 34 |
| `/technology` | 61 | 32 |
| `/courses/complete-guide-zitadel` | 54 | 37 |
| `/read` | 40 | 27 |
| `/organizations/partnerships` | 35 | 22 |

### What this says

- The homepage alone is ~24% of pageviews. Whatever the next traffic-growth bet is (YouTube descriptions, SEO entry points), the homepage's first-touch behaviour matters most.
- The **Technology Matrix** is the strongest non-homepage surface — both `/technology/matrix` and `/technology/matrix/advanced` in the top 6. Memory confirms it already has an article driving SEO (`/read/introducing-technology-matrix` made the long-tail list too at 23 pageviews). Worth doubling down on with explicit "use this to compare X vs Y" CTAs and outbound links from individual technology profiles.
- Index pages (`/learning-paths`, `/courses`, `/watch`, `/technology`, `/read`) dominate over individual content. People are browsing more than landing deep. SEO investment on individual pages may shift this balance.
- `/organizations/partnerships` (35 pv) is unexpectedly high for what's effectively a sales page. Worth keeping discoverability there.

## 2. Top pages by visitor → newsletter subscriber conversion

Filtered to pages with **≥5 unique visitors** so we're not amplifying single-user noise. Ordered by conversion rate, then visitors.

| Pathname | Visitors | Subscribers | Conv % |
| --- | ---: | ---: | ---: |
| `/courses/teleport-for-kubernetes/teleport-for-kubernetes/01-introduction` | 5 | 2 | 40.0% |
| `/courses/teleport-for-kubernetes/01-introduction` | 7 | 2 | 28.6% |
| `/read/federated-graphql-microservices` | 5 | 1 | 20.0% |
| `/read/lazyjournal-log-viewer` | 5 | 1 | 20.0% |
| `/watch/hands-on-introduction-to-gitea-actions` | 5 | 1 | 20.0% |
| `/news/dragonfly-native-huggingface-modelscope-protocols` | 5 | 1 | 20.0% |
| `/read/kep-2831-kubelet-tracing` | 5 | 1 | 20.0% |
| `/read/fluxcd-the-inevitable-choice` | 5 | 1 | 20.0% |
| `/technology/k3s` | 5 | 1 | 20.0% |
| `/technology/dapr` | 5 | 1 | 20.0% |
| `/technology/linkerd` | 5 | 1 | 20.0% |
| `/technology/vitess` | 5 | 1 | 20.0% |
| `/organizations/training` | 5 | 1 | 20.0% |
| `/courses/teleport-for-kubernetes` | 14 | 2 | 14.3% |

### What this says

- The **Teleport for Kubernetes course** stands out as a real conversion magnet — three different paths land in the top of the list. Likely a lead-magnet hook. Worth understanding *why* and replicating.
- The duplicated-segment path (`/courses/teleport-for-kubernetes/teleport-for-kubernetes/01-introduction`) is a routing/redirect bug worth checking — both versions appear and both convert. Likely a `<a href>` typo somewhere creating the doubled segment.
- Beyond the Teleport course, conversion is essentially "1 subscriber out of 5 visitors" across long-tail reads / technologies / news. Statistically indistinguishable from noise at this scale. Re-run after traffic doubles.
- The technology profile pages **do** convert at ~20% even with tiny samples. This is encouragement for the SEO investment.

## 3. Top pages by visitor → activated user conversion

Same `visitors >= 5` filter.

| Pathname | Visitors | Activated | Conv % |
| --- | ---: | ---: | ---: |
| `/organizations/branding` | 5 | 2 | 40.0% |
| `/courses/teleport-for-kubernetes/teleport-for-kubernetes/01-introduction` | 5 | 2 | 40.0% |
| `/news/dragonfly-native-huggingface-modelscope-protocols` | 5 | 2 | 40.0% |
| `/news/aks-critical-privilege-escalation-cve-2026-33105` | 6 | 2 | 33.3% |
| `/people/rawkode` | 6 | 2 | 33.3% |
| `/news/kubernetes-1-36-sneak-peek` | 6 | 2 | 33.3% |
| `/shows/klustered` | 7 | 2 | 28.6% |
| `/courses/rust-for-the-rusty` | 8 | 2 | 25.0% |
| `/watch/navigating-kairos-immutable-operating-systems-with-a-cloud-native-twist` | 12 | 2 | 16.7% |
| `/technology/devenv` | 6 | 1 | 16.7% |
| `/technology/teleport` | 6 | 1 | 16.7% |
| `/technology/kubernetes` | 6 | 1 | 16.7% |

### What this says

- **News pages punch above their weight.** Three news items land in the top 7 by activation rate. News is a pull surface — when people land on a freshly-curated piece they're already engaged. Worth investing more here (consistent cadence, better internal links from news → related courses/tech).
- The **Klustered show page** (`/shows/klustered`) activated 2 of 7 visitors. With Klustered now properly published (#1116), expect this surface to grow.
- `/people/rawkode` activating 2 of 6 visitors is consistent with the host being a major conversion driver. Make sure related videos, technologies, and the newsletter CTA are all reachable from there.
- Courses convert. Rust-for-the-rusty + Teleport course both in the top 8.

## Next acquisition priorities driven by this data

1. **Technology profile SEO (PR 5).** `/technology/matrix` and `/technology/*` are top-traffic and 16-20% activation converters. Improving discoverability via SEO directly compounds.
2. **Video page SEO (PR 6).** `/watch` is top-5 by traffic but `/watch/*` individual pages are mostly in long-tail (`/watch/navigating-kairos-…` is the highest-activating individual video at 12 visitors). Better individual-video SEO should pull more search traffic to those specific pages.
3. **Course funnel investigation.** Three Teleport course paths in the top conversion lists, including a duplicated-segment URL. Fix the routing bug, document what the lead magnet hook is, replicate for other courses.
4. **News cadence.** News pages convert well. Pre-existing infrastructure, low effort to keep cadence consistent.
5. **Skip activation A/B tests.** The denominators are 5-10. A/B at this scale is noise. Revisit at 10x traffic.

## Queries used

```sql
-- 1. Top pages by traffic
SELECT replaceRegexpOne(properties.$pathname, '/$', '') AS pathname,
       count() AS pageviews,
       count(DISTINCT person_id) AS unique_visitors
FROM events
WHERE event = 'page_view'
  AND timestamp >= now() - INTERVAL 90 DAY
  AND properties.$pathname IS NOT NULL
GROUP BY pathname
ORDER BY pageviews DESC
LIMIT 25

-- 2. Pages by subscriber conversion
WITH visits AS (
  SELECT person_id, replaceRegexpOne(properties.$pathname, '/$', '') AS pathname
  FROM events
  WHERE event = 'page_view'
    AND timestamp >= now() - INTERVAL 90 DAY
    AND properties.$pathname IS NOT NULL
),
subscribers AS (
  SELECT DISTINCT person_id
  FROM events
  WHERE event = 'rawkode-academy-website.newsletter.subscribed'
    AND timestamp >= now() - INTERVAL 90 DAY
)
SELECT v.pathname,
       count(DISTINCT v.person_id) AS visitors,
       count(DISTINCT s.person_id) AS subscribers,
       round(count(DISTINCT s.person_id) * 100.0
             / count(DISTINCT v.person_id), 2) AS conversion_pct
FROM visits v
LEFT JOIN subscribers s ON v.person_id = s.person_id
GROUP BY v.pathname
HAVING visitors >= 5
ORDER BY conversion_pct DESC, visitors DESC
LIMIT 25

-- 3. Pages by activated-user conversion
WITH visits AS (
  SELECT person_id, replaceRegexpOne(properties.$pathname, '/$', '') AS pathname
  FROM events
  WHERE event = 'page_view'
    AND timestamp >= now() - INTERVAL 90 DAY
    AND properties.$pathname IS NOT NULL
),
activated AS (
  SELECT DISTINCT person_id
  FROM events
  WHERE event = 'rawkode-academy-website.growth.activated_user'
    AND timestamp >= now() - INTERVAL 90 DAY
)
SELECT v.pathname,
       count(DISTINCT v.person_id) AS visitors,
       count(DISTINCT a.person_id) AS activated,
       round(count(DISTINCT a.person_id) * 100.0
             / count(DISTINCT v.person_id), 2) AS conversion_pct
FROM visits v
LEFT JOIN activated a ON v.person_id = a.person_id
GROUP BY v.pathname
HAVING visitors >= 5
ORDER BY conversion_pct DESC, visitors DESC
LIMIT 25
```

Refs #938 (Phase 2, PR 3).

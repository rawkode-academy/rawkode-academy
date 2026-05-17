# Traffic sources — diagnostic report

Snapshot taken 2026-05-17 from PostHog. Window: last 90 days. Source event: `page_view`. Maps referring domains into seven buckets so we can compare volume and quality side by side.

This report exists to answer: **which acquisition surface deserves the next round of investment?**

## Caveats

- Same denominator caveats as `top-landing-pages.md` — small samples, directional only.
- The "referring domain" PostHog captures is the immediate referrer of a single page view, not the originating source of the user. A user who lands from Twitter, then navigates around the site, will appear in *both* `social` and `internal`.
- `internal` rows are intentionally kept so the magnitude of within-site navigation vs external entry is visible.
- `dev_or_preview` (localhost, `*.workers.dev`) is my own dev traffic and should be ignored.
- Last 90d UTM-tagged traffic: ChatGPT (~35 pageviews, via PostHog's auto-tag) and one LinkedIn organic post. Essentially zero campaign tagging is in place today — PR 2's attribution infrastructure exists, but it can only show value once we start tagging campaigns.

## Volume × quality matrix (last 90d)

| Source | Unique visitors | Subscribers | Activated | Sub % | Act % |
| --- | ---: | ---: | ---: | ---: | ---: |
| **direct** (bookmarks, typed, untagged) | 297 | 1 | 2 | 0.34% | 0.67% |
| **search** (Google, Bing, DDG, Yahoo, Yandex, Brave, Ecosia) | 214 | 2 | 1 | 0.93% | 0.47% |
| **internal** (rawkode.academy → rawkode.academy) | 64 | 1 | 2 | 1.56% | 3.12% |
| **social** (Twitter/X, Bluesky, LinkedIn, Reddit, HN, linktr.ee) | 41 | 2 | 1 | 4.88% | 2.44% |
| **other** (long tail) | 28 | 1 | 1 | 3.57% | 3.57% |
| **youtube** (youtube.com + m.youtube.com) | 27 | 1 | 1 | 3.70% | 3.70% |
| **ai_assistant** (ChatGPT, Perplexity, Gemini, Claude, askboth) | 17 | 1 | 1 | 5.88% | 5.88% |
| dev_or_preview (my own) | 3 | — | — | — | — |

### Reading this

- **Search wins on raw volume of external traffic** — 214 visitors / 90d ≈ 2.4/day. It's the biggest single external acquisition channel.
- **AI assistants are the highest-converting source by a clear margin** — 5.88% on both axes. ChatGPT alone delivered 14 unique visitors who behave like already-qualified leads (someone asked an LLM about a tech, the LLM cited Rawkode Academy, the user followed the link).
- **YouTube → website conversion is real but tiny** — 27 visitors in 90 days = ~0.3/day. With the channel's actual audience (~tens of thousands of subscribers) this should be 10-100×. Almost certainly a missing-CTA problem in YouTube video descriptions.
- **Direct is the biggest single bucket and the worst-converting** — 297 visitors, 0.34% subscribe rate. These are bookmarks and untagged links. A real chunk is probably mis-attributed (clients that strip Referer headers), but the conversion gap vs. search isn't a measurement bug, it's a real signal that these are returning low-intent visitors.
- **Social has solid conversion** — 4.88% subscribe rate on 41 visitors. Worth keeping cadence consistent, even at low volume.

## What this implies for the next PRs

1. **YouTube description CTAs (PR 8) is the single highest-leverage acquisition move.** Audience exists (YouTube subscribers, every video view is a potential visit). The conversion rate when they do click through is decent (3.7%). The funnel entry is the constraint, not the funnel.
2. **SEO on `/technology/[id]` and `/watch/[...slug]` (PRs 5 + 6) compounds with search dominating external traffic.** Better titles, meta descriptions, structured data → better SERP click-through → more search visitors at a 0.93% subscribe rate (low, but it's the largest external channel).
3. **AI-assistant traffic deserves its own thinking.** It converts at 5.88% but we're not actively cultivating it. The honest acquisition move here is to make sure the site's content is *cite-worthy* — accurate, current, distinctive — so LLMs reach for Rawkode Academy when their users ask questions in this domain. That's already the strategy with the Technology Matrix; the data validates it.
4. **Direct conversion is a follow-up problem, not a priority.** Don't optimise a high-volume, low-intent bucket before fixing the high-intent, low-volume ones.

## Top external domains (last 90d)

For reference, the raw referring domain breakdown (excluding `$direct`, internal navigation, and my own dev traffic):

| Referring domain | Pageviews | Unique visitors |
| --- | ---: | ---: |
| `www.google.com` | 443 | 179 |
| `www.youtube.com` | 125 | 26 |
| `duckduckgo.com` | 109 | 10 |
| `github.com` | 48 | 13 |
| `t.co` (Twitter/X) | 43 | 22 |
| `chatgpt.com` | 28 | 14 |
| `www.bing.com` | 25 | 11 |
| `go.bsky.app` | 16 | 6 |
| `search.yahoo.com` | 14 | 2 |
| `www.linkedin.com` | 11 | 7 |
| `gemini.google.com` | 8 | 1 |
| `www.fermyon.com` | 7 | 1 |
| `yandex.ru` | 6 | 6 |
| `www.perplexity.ai` | 5 | 1 |
| `m.youtube.com` | 2 | 1 |
| `www.reddit.com` | 3 | 3 |

DuckDuckGo punching above its weight (109 pageviews from just 10 users — the heavy users prefer DDG). Google still ~3.5× of Bing+DDG combined for unique visitors.

## Queries used

```sql
-- Top referring domains
SELECT properties.$referring_domain AS domain,
       count() AS pageviews,
       count(DISTINCT person_id) AS unique_visitors
FROM events
WHERE event = 'page_view'
  AND timestamp >= now() - INTERVAL 90 DAY
GROUP BY domain
ORDER BY pageviews DESC
LIMIT 30

-- Volume × quality by source bucket
-- Note: chatgpt.com contains 't.co' as a substring, so social vs ai_assistant
-- buckets must use exact-domain IN clauses rather than substring regex.
WITH source_visitors AS (
  SELECT
    person_id,
    multiIf(
      properties.$referring_domain = '$direct', 'direct',
      properties.$referring_domain IN ('chatgpt.com', 'www.perplexity.ai',
                                       'gemini.google.com', 'claude.ai',
                                       'www.askboth.com'),
        'ai_assistant',
      match(properties.$referring_domain,
            '(\.|^)(youtube\.com|m\.youtube\.com)$'),
        'youtube',
      properties.$referring_domain IN ('t.co', 'twitter.com', 'x.com',
                                       'go.bsky.app', 'www.linkedin.com',
                                       'www.reddit.com',
                                       'news.ycombinator.com', 'linktr.ee'),
        'social',
      match(properties.$referring_domain,
            '(google|bing|duckduckgo|yahoo|yandex|baidu|ecosia)'),
        'search',
      properties.$referring_domain = 'rawkode.academy', 'internal',
      match(properties.$referring_domain,
            '(localhost|workers\.dev|127\.0\.0\.1|rawkodeacademy\.workers)'),
        'dev_or_preview',
      'other'
    ) AS source
  FROM events
  WHERE event = 'page_view'
    AND timestamp >= now() - INTERVAL 90 DAY
),
subscribers AS (
  SELECT DISTINCT person_id
  FROM events
  WHERE event = 'rawkode-academy-website.newsletter.subscribed'
    AND timestamp >= now() - INTERVAL 90 DAY
),
activated AS (
  SELECT DISTINCT person_id
  FROM events
  WHERE event = 'rawkode-academy-website.growth.activated_user'
    AND timestamp >= now() - INTERVAL 90 DAY
)
SELECT v.source,
       count(DISTINCT v.person_id) AS visitors,
       count(DISTINCT s.person_id) AS subscribers,
       count(DISTINCT a.person_id) AS activated,
       round(count(DISTINCT s.person_id) * 100.0
             / count(DISTINCT v.person_id), 2) AS sub_pct,
       round(count(DISTINCT a.person_id) * 100.0
             / count(DISTINCT v.person_id), 2) AS act_pct
FROM source_visitors v
LEFT JOIN subscribers s ON v.person_id = s.person_id
LEFT JOIN activated a ON v.person_id = a.person_id
GROUP BY v.source
ORDER BY visitors DESC
```

Refs #938 (Phase 2, PR 4).

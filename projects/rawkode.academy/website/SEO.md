# Rawkode Academy Website SEO & Discovery Architecture

This document summarizes the technical SEO, structured data, crawlability, and Core Web Vitals invariants maintained across `https://rawkode.academy` (Milestones M1–M5).

## 1. Domain Canonicalization, Heads & Structured Data (M1)
- **Apex domain enforcement:** `infrastructure/dns/domains/rawkode.academy.cue` configures `www` CNAME, `src/worker.ts` 301-redirects `www.rawkode.academy` to `https://rawkode.academy`, and non-production hosts (`*.workers.dev`, preview deployments) receive `X-Robots-Tag: noindex, nofollow`.
- **Feed & discovery headers:** `src/middleware/robots.ts` exempts `/api/feeds/` from `noindex` on production hosts.
- **OG imagery & share cards:** `src/lib/open-graph.ts` and `projects/rawkode.academy/platform/image-service/src/lib/render.ts` route Open Graph share imagery through `https://image.rawkode.academy` as 1200x630 PNGs rather than exposing raw `.svg` files; square and SVG logos use `object-fit: contain`.
- **Head hygiene:** `src/components/html/head.astro` and `src/components/html/opengraph.astro` decouple `ogTitle` from `<title>`, deduplicate brand suffixes, clamp meta descriptions at word boundaries (≤ 160 chars), validate `canonicalUrl` (rejecting protocol-relative/external/`javascript:` inputs), link `/opensearch.xml`, and suppress JSON-LD on `noindex` pages.
- **Schema.org graph:** `Organization` / `EducationalOrganization` uses `@id` `https://rawkode.academy/#organization` linked from `WebSite` and `WebPage`; `serializeJsonLd()` escapes `</script>` breakouts; `BroadcastEvent` includes `endDate`; `course-jsonld.astro` omits empty `teaches`.

## 2. Sitemaps, Feeds & Discovery Endpoints (M2)
- **VOD readiness (`hasTranscodedVodAssets`):** `src/lib/content.ts` ensures `video-sitemap.xml.ts` never links un-transcoded `stream.m3u8` URLs for un-transcoded `live` items (falling back to YouTube `<video:player_loc>` when available or omitting), omits non-positive durations, and excludes un-transcoded episodes from podcast RSS feeds (`shows/[showId].xml.ts`).
- **Feeds:** RSS, Atom, and JSON feeds strip trailing slashes to match `trailingSlash: "never"`, emit Atom `<author>` elements, escape XML/CDATA safely, include `image/webp`, and omit 0-episode/empty feeds from `feeds.astro` and `feeds.opml.ts`.
- **Sitemaps:** `src/lib/sitemaps.ts` exports `isTechnologyIndexable()` and `isShowIndexable()`, filters thin `noindex` technologies and 0-episode shows, emits `<lastmod>` on `shows.xml`, omits empty `news-sitemap.xml` from `sitemap-index.xml`, and indexes `/series`, `/series/[id]`, `/technology/matrix/advanced`, and Klustered subpages.
- **Discovery & Robots:** `llms-full.txt.ts` returns `X-Robots-Tag: noindex`, `read/[...slug].md.ts` handles multi-segment slugs, `robots.txt.ts` aligns `/settings` and lets crawlers read `noindex` confirmation/unsubscribe routes.

## 3. Content, Editorial & Archive SEO (M3)
- **Technology autolinking:** `src/lib/live-content/render/render.ts` (`RENDER_VERSION = "v3"`) autolinks technologies across technology descriptions as well as video and show descriptions while skipping self-links.
- **Articles & Watch:** Deterministic topical similarity in `src/lib/related-articles.ts`; `/read` keeps pagination self-canonical (`?page=N`) with proper heading hierarchy and author `/people/` links; `/watch` uses 16:9 R2 WebP thumbnails (`getVideoThumbnailResizedUrl` / `getVideoThumbnailUrl`), gates `streamUrl`/`captionUrl` truthfully, and adds related guides & courses.
- **People, Shows, News, Learning Paths & Series:** Aligned indexability checks, pagination self-canonicals, `noindex` on future/thin profiles, `BroadcastEvent` `endDate`, and semantic headings.

## 4. Technology Hubs, Courses & Orphan Routes (M4)
- **Technology hubs & Matrix:** `/technology/[id]` aligns `noindex` with `isTechnologyIndexable`, renders published courses, and resizes thumbnails. `/technology/matrix` and `/technology/matrix/advanced` wire real published article counts, expose `CollectionPage` + `BreadcrumbJsonLd` + deduplicated `ItemList` JSON-LD, render crawlable `<a href="/technology/...">` tiles with keyboard/modifier-click preservation, mark `?fs=` facet links `rel="nofollow"`, and defer Explorer hydration (`client:idle`).
- **Courses:** `CourseDetailHero`, `/courses`, `/courses/[...slug]`, and `/courses/[course]/[slug]` include breadcrumbs, technology links, unconditional `CourseJsonLd`, `VideoMetadata`, SSR video fallback posters + `<noscript>` stream links, collapsible curriculum, and resized catalog imagery.
- **Previously orphaned routes & navigation:** Full SSR content on `/resources/kubernetes/1.35-cheatsheet` (inline subscription CTA), unconditional SSR headers/breadcrumbs/links on `/games/*`, global navigation links in `src/lib/navigation.ts` with `rel="nofollow"` forwarded for `/settings`, and cross-links across `/organizations/*` and `/supporters`.

## 5. Core Web Vitals & Hydration (M5)
- **Zero-delay LCP typography:** `academyLayout.ts` and `academyPage.ts` animate hero headlines and descriptions with `academy-settle` (transform-only, never starting at `opacity: 0`).
- **CLS & image weight:** Explicit `width`/`height` attributes on masthead mosaic tiles (`AcademyCatalogMasthead.astro`), catalog cards (`AcademyCatalogCard.astro`), and show cards (`ShowCard.astro`), plus Cloudflare Image Resizing (`getVideoThumbnailResizedUrl` / `resizeRemoteImageUrl`) across video recommendation rails.
- **Reduced client JS:** `ThemeToggle` (`client:idle`), `MobileNavigation` (`client:media="(max-width: 1023px)"`), `VideoReactionsClient` (`client:visible`), `ResourceList` (`client:idle`), `TechnologyExplorer` (`client:idle`), and native SSR `<dialog>` zoom in `RichTextIsland.astro` (removing `react-medium-image-zoom`).
- **Baseline items already present prior to M5:** `src/pages/index.astro` already removed `ContinueWatchingRail`, and `AcademyPage.vue` already links featured `<h2>` headlines directly.

## 6. Verification Commands
Run from repo root after `cuenv sync -A` (serializing shared workspace builds via `flock`):

```bash
# Design system + website shell, interaction, SSR, Astro typecheck & build
cd projects/rawkode.academy/website && bun run build

# Website unit & SEO contract tests (M1–M5)
cd projects/rawkode.academy/website && bun run test

# Image service unit tests
cd projects/rawkode.academy/platform/image-service && bun run test

# DNS CUE validation
cd infrastructure/dns && cue vet -c=false ./domains && cue vet -c=false .

# Live-site SEO audits (post-deploy)
cd projects/rawkode.academy/website && bun run validate:seo && bun run check:sitemap && bun run check:orphans
```

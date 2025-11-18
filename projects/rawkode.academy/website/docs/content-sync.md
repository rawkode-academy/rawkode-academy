# GraphQL → Content Sync

This project now synchronizes video, show, and technology data from the Rawkode Academy GraphQL API into local Astro content collections. This removes the need to call the remote API at runtime for these entities.

## What gets generated

 - Videos are bucketed (Option A):
   - Shows: `content/videos/shows/<showId>/<YYYY>/<slug>.md`
   - Standalone: `content/videos/standalone/<YYYY>/<slug>.md`
- `content/shows/*.md` — one Markdown file per show
- Technologies are stored in the workspace package `@rawkodeacademy/content-technologies` at `../../../content/technologies/data/*.md`
  - For each technology `id`, files are placed under `data/<id>.mdx` with metadata in frontmatter
  - Technology data is shared across all projects in the monorepo

The content schemas are defined in `src/content/config.ts` and consumed by pages/components.

## How to run

Environment variable:

- `GRAPHQL_ENDPOINT` (optional) — defaults to `https://api.rawkode.academy/graphql`

Run the sync:

```bash
npm run sync:content
```

This script runs automatically before `npm run build` via the `prebuild` hook. If the API is unavailable, the build will still proceed but the generated pages may be empty.

## Notes

- Sync is idempotent: it updates/creates files and removes stale ones.
- Video descriptions are stored as frontmatter strings. Newlines are preserved.
- Chapters are still fetched on-demand during video page render; if desired, they can be added to the sync in a follow-up.
- Referential integrity: videos store `technologies` as an array of technology IDs and `show` as the show ID. Astro `reference()` ensures these IDs match existing entries in `content/technologies` and `content/shows`.
- Dates: `publishedAt` for videos is written as a full ISO 8601 datetime (UTC), and validated in the content schema as a Date.
- Midnight dates: if a video’s `publishedAt` time is 00:00:00, it is normalized to 17:00:00Z (GMT) to reflect the desired publishing time.
- Derived fields: `streamUrl`, `thumbnailUrl`, and `duration` are not stored in content. They are derived at runtime. Duration is fetched from the GraphQL API where needed (pages, feeds, sitemap).
- People: show `hosts` are references to the `people` collection; the sync script creates missing people entries from GraphQL show hosts.

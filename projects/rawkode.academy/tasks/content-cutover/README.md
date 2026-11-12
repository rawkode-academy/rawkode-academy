# Content cutover

One-off steps that move production from `content/` to the D1 platform services (#1468). `scripts/build-seeds.ts` builds `seeds/` and `scripts/verify-fixtures.ts` checks them against each service's `tests/fixtures.sql`.

Articles have since moved back to Markdown/MDX files in `content/articles` (#1578) and the `platform-articles` service and database are gone, so `seeds/articles.sql` and the article steps in `scripts/build-seeds.ts` are history.

## Post-seed patches

The seeds were built from a production dump and `content/` as of the #1468 snapshot. Content that changed on `main` afterwards is carried by the SQL files in `post-seed/`, applied in order once the seeds have run:

```bash
cd projects/rawkode.academy/platform/videos
cuenv -e production exec -- bun x wrangler d1 execute platform-videos --remote \
	--file ../../tasks/content-cutover/post-seed/0002-swamp-club-video-description.sql
```

| Patch | Database | Source |
| --- | --- | --- |
| `0002-swamp-club-video-description.sql` | `platform-videos` | live description rewritten on 2026-10-23 |

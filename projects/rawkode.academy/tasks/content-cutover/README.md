# Content cutover

One-off steps that move production from `content/` to the D1 platform services (#1468).

## Post-seed patches

The seeds were built from a production dump and `content/` as of the #1468 snapshot. Content that changed on `main` afterwards is carried by the SQL files in `post-seed/`, applied in order once the seeds have run:

```bash
cd projects/rawkode.academy/platform/articles
cuenv -e production exec -- bun x wrangler d1 execute platform-articles --remote \
	--file ../../tasks/content-cutover/post-seed/0001-klustered-winter-2026.sql
```

| Patch | Database | Source |
| --- | --- | --- |
| `0001-klustered-winter-2026.sql` | `platform-articles` | #1481 |

# Content cutover checklist (#1468)

The ordered steps that move production from `content/` to the D1 platform
services. The original checklist and seeds were lost with the session's `/tmp`;
this one and everything in `seeds/` was rebuilt on 2026-10-25 with
`scripts/build-seeds.ts`.

Run commands from the repository root unless a step says otherwise. Every
`wrangler` call against production runs in the service's directory through
`cuenv -e production exec --`, which supplies `CLOUDFLARE_API_TOKEN`.

## 0. Build and verify the seeds

The seeds are built from `content/` at `cc079bee7`, the #1468 snapshot, so that
each service's `tests/fixtures.sql` (a slice of the original seed) can check
them row for row. Content that changed on `main` afterwards is carried by
`post-seed/`.

```bash
SNAP=$(mktemp -d)
git archive cc079bee7 content | tar -x -C "$SNAP"
nix shell nixpkgs#d2 -c bun projects/rawkode.academy/tasks/content-cutover/scripts/build-seeds.ts \
	--content "$SNAP/content" --rev cc079bee7 \
	--out projects/rawkode.academy/tasks/content-cutover/seeds
for s in articles news changelog adrs testimonials courses; do
	bun projects/rawkode.academy/tasks/content-cutover/scripts/verify-fixtures.ts \
		"$s" "projects/rawkode.academy/tasks/content-cutover/seeds/$s.sql"
done
```

Output in `seeds/`:

| File | Database | Kind |
| --- | --- | --- |
| `articles.sql` | `platform-articles` | seed: 34 articles, authors, technologies |
| `news.sql` | `platform-news` | seed: 37 stories, authors, technologies |
| `changelog.sql` | `platform-changelog` | seed: 16 entries |
| `adrs.sql` | `platform-adrs` | seed: 2 ADRs, authors |
| `testimonials.sql` | `platform-testimonials` | seed: 12 testimonials |
| `courses.sql` | `platform-courses` | seed: 4 courses, 28 modules, 4 learning paths |
| `backfill-videos.sql` | `platform-videos` | `description_doc` for 330 videos |
| `backfill-shows.sql` | `platform-shows` | `description_doc`, Cloud Native Compass cover and size |
| `backfill-technologies.sql` | `platform-technologies` | `body` for 355 technologies |
| `backfill-people-biographies.sql` | `platform-people-biographies` | `biography_doc`, built from the live table (step 2) |
| `assets.json`, `diagrams/` | R2 `rawkode-academy-content` | covers, inline images, d2 diagrams, technology logos |

No person in `content/` has a biography body: biographies exist only in the
live `people_biographies.biography` column, so their backfill is built from the
step 2 export.

## 1. Drift since the snapshot

```bash
git log --oneline cc079bee7..origin/main -- content/
```

Only #1481 (carried by `post-seed/0001-klustered-winter-2026.sql`) is expected.
Compare live row counts and `max(updated_at)` for videos, people, technologies
and shows with `content/`, and hold video imports until the cutover is
verified. `content/` is frozen until #1468 merges.

## 2. Back up the live databases

```bash
BACKUP=~/content-cutover-backups/$(date +%Y%m%dT%H%M%S)
mkdir -p "$BACKUP"
for db in videos shows technologies people people-biographies; do
	(cd projects/rawkode.academy/platform/$db && \
		cuenv -e production exec -- bun x wrangler d1 export platform-$db --remote --output "$BACKUP/platform-$db.sql")
done
```

## 3. Cutover

### 3.1 R2

Upload everything in `seeds/assets.json` to `rawkode-academy-content`.

### 3.2 D1 migrations

```bash
for db in articles news changelog adrs testimonials courses videos shows technologies people-biographies; do
	(cd projects/rawkode.academy/platform/$db && \
		cuenv -e production exec -- bun x wrangler d1 migrations apply platform-$db --remote)
done
```

New databases get `0000`. The live ones get only additive columns: videos
`0002`, shows `0002` and `0003`, technologies `0002`, people-biographies
`0001`.

### 3.3 Seeds, backfills, post-seed

```bash
run() { (cd projects/rawkode.academy/platform/$1 && \
	cuenv -e production exec -- bun x wrangler d1 execute platform-$1 --remote --file "$2"); }
S=$PWD/projects/rawkode.academy/tasks/content-cutover
for db in articles news changelog adrs testimonials courses; do run $db "$S/seeds/$db.sql"; done
for db in videos shows technologies people-biographies; do run $db "$S/seeds/backfill-$db.sql"; done
run articles "$S/post-seed/0001-klustered-winter-2026.sql"
```

### 3.4 Deploy

The 11 changed services (adrs, articles, changelog, courses, news, people,
people-biographies, shows, technologies, testimonials, videos), then the API
gateway (`projects/rawkode.academy/api`). The composed supergraph must have 24
subgraphs.

### 3.5 Cache invalidation secret

Create `CACHE_INVALIDATION_TOKEN` in 1Password, set it as a secret on the
website Worker, and point `tasks/video-importer/env.cue` at the real reference.

### 3.6 Swamp Club captions

Upload the caption fixes for the Swamp Club video.

## 4. Verify before merging

- Gateway counts match `content/` on main: 34 articles, 37 news, 16 changelog,
  2 ADRs, 12 testimonials, 4 learning paths, 330 videos, 355 technologies,
  264 people.
- `RichTextDocument` fields on an article, a technology, a video and a show.
- Route comparison: latest CI website preview against rawkode.academy. Feeds,
  sitemaps and `.md` endpoints byte-identical; pages structurally equal;
  `/read/klustered-winter-2026` shows the 18 November wording.
- `/read/kubernetes-operators-rust-kube-rs`: diagrams inline and follow the
  theme toggle.

## 5. Merge and after

Squash-merge #1468, then purge the cache with `POST /api/cache/invalidate`
(bearer `CACHE_INVALIDATION_TOKEN`) and run the smoke tests.

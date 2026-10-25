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
| `assets.json`, `diagrams/` | R2 `rawkode-academy-content` | covers, inline images, d2 diagrams, technology logos |

People-biographies needs no backfill: no person in `content/` has a
biography body, and the live `people_biographies` table was empty on
2026-10-25. It only gets the `0001` column.

## 1. Drift since the snapshot

```bash
git log --oneline cc079bee7..origin/main -- content/
```

Only #1481 (carried by `post-seed/0001-klustered-winter-2026.sql`) is expected.
Compare live row counts and `max(updated_at)` for videos, people, technologies
and shows with `content/`, and hold video imports until the cutover is
verified. `content/` is frozen until #1468 merges.

On 2026-10-25 the counts matched (330 videos, 264 people, 355 technologies,
10 shows) and three rows had been written after the 2026-10-21 seed, all on
2026-10-23 for the Swamp Club stream: video `rez4r4sbaaog76765ijmdpli`,
technology `swamp` and person `nickstinemates`. Only the video's description
differs from `content/`, so `post-seed/0002-swamp-club-video-description.sql`
rebuilds its `description_doc` from the live description.

## 2. Back up the live databases

```bash
export OP_ACCOUNT=rawkodeacademy.1password.eu  # the token's vault is in this account
BACKUP=~/content-cutover-backups/$(date +%Y%m%dT%H%M%S)
mkdir -p "$BACKUP"
for db in videos shows technologies people people-biographies video-technologies video-guests show-hosts \
	articles news changelog adrs testimonials courses; do
	(cd projects/rawkode.academy/platform/$db && \
		cuenv -e production exec -- bun x wrangler d1 export platform-$db --remote --output "$BACKUP/platform-$db.sql")
done
```

## 3. Cutover

### 3.1 R2

Upload everything in `seeds/assets.json` to `rawkode-academy-content`. Keys
that already exist are skipped, never overwritten. Run it with the `CONTENT_*`
variables from `tasks/video-importer/env.cue` (resolved by `op run --env-file`,
or by `cuenv -e production exec` in that directory):

```bash
bun projects/rawkode.academy/tasks/content-cutover/scripts/upload-assets.ts --content "$SNAP/content"
```

On 2026-10-25, 233 objects (every technology `icon.svg`) already existed and
were byte-identical to `content/`; the other 514 were uploaded, and all 747
then returned 200 with the expected Content-Type.

### 3.2 D1 migrations

```bash
for db in articles news changelog adrs testimonials courses videos shows technologies people-biographies; do
	(cd projects/rawkode.academy/platform/$db && \
		cuenv -e production exec -- bun x wrangler d1 migrations apply DB --remote --config ./read-model/wrangler.jsonc)
done
```

New databases get `0000`. The live ones get only additive columns: videos
`0002`, shows `0002` and `0003`, technologies `0002`, people-biographies
`0001`.

### 3.3 Seeds, backfills, post-seed

```bash
run() { (cd projects/rawkode.academy/platform/$1 && \
	cuenv -e production exec -- bun x wrangler d1 execute DB --remote --config ./read-model/wrangler.jsonc --file "$2" -y); }
S=$PWD/projects/rawkode.academy/tasks/content-cutover
for db in articles news changelog adrs testimonials courses; do run $db "$S/seeds/$db.sql"; done
for db in videos shows technologies; do run $db "$S/seeds/backfill-$db.sql"; done
run articles "$S/post-seed/0001-klustered-winter-2026.sql"
run videos "$S/post-seed/0002-swamp-club-video-description.sql"
```

Rehearse first on copies of the step 2 exports (apply pending migrations, then
these files, with `bun:sqlite`); on 2026-10-25 every file applied and the
counts matched.

### 3.4 Deploy

The 11 changed services (adrs, articles, changelog, courses, news, people,
people-biographies, shows, technologies, testimonials, videos), then the API
gateway (`projects/rawkode.academy/api`). The composed supergraph must have 24
subgraphs. (`video-thumbnails` changed only in its local scripts.)

```bash
for s in articles news changelog adrs testimonials courses videos shows technologies people people-biographies; do
	(cd projects/rawkode.academy/platform/$s && cuenv -e production task ciDeploy)
done
(cd projects/rawkode.academy/api && cuenv -e production task deploy)
```

### 3.5 Cache invalidation secret

Create the token in 1Password (a generated password in the `sa.rawkode.academy`
vault) and point the `CACHE_INVALIDATION_TOKEN` reference in
`tasks/video-importer/env.cue` at it.

Setting it on the website Worker has to wait until #1468's website build is
deployed: `wrangler secret put` refuses while the latest version is an
undeployed PR preview upload, and deploying a preview to get past that would
ship #1468 early. Right after the merge deploy, pipe the token from `op read`
into `bun x wrangler secret put CACHE_INVALIDATION_TOKEN --name rawkode-academy-website`,
with the platform's workers token as `CLOUDFLARE_API_TOKEN`.

### 3.6 Swamp Club captions

`videos/rez4r4sbaaog76765ijmdpli/captions/en.vtt` was still the raw Deepgram
output. The original fixes were lost; on 2026-10-25 these were re-applied
(text only, timings unchanged) and uploaded, leaving `en.deepgram.vtt` as the
raw copy:

- "start with stop swamp start" → "start with swamp start"
- "a system d unit" → "a systemd unit"
- "post hoc swamp extension" → "PostHog Swamp extension"
- "Opus five five" → "Opus 5.5"

Left for a human: "known on the Internet as forever" (00:02:49, Nick's handle)
and "web ramp has a GitHub extension" (00:15:28, the extension's author).

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

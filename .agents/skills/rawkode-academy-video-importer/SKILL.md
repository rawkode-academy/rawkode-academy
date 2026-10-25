---
name: rawkode-academy-video-importer
description: "Import YouTube videos into Rawkode Academy: run the video-importer, upload R2 assets, create the platform-videos D1 row and its episode/guest/technology rows, invalidate the website cache, verify transcoding, trigger and verify transcription, and avoid claiming triggered jobs are complete before artifacts exist."
---

# Rawkode Academy Video Importer

Use this skill when importing a YouTube video into Rawkode Academy, especially when the task mentions `projects/rawkode.academy/tasks/video-importer`, R2 uploads, transcoding, transcription, captions, or episode descriptions.

## Critical Rule

Separate evidence for each stage:

- Import/upload complete means the importer state has `completed` and the original R2 assets return `200`.
- The video exists means the importer state has `d1_written` and `videoByID` returns it from `https://api.rawkode.academy`.
- Transcoding complete means `https://content.rawkode.academy/videos/<cuid>/stream.m3u8` returns `200`, or Cloud Run shows the execution completed successfully.
- Transcription complete means `https://content.rawkode.academy/videos/<cuid>/captions/en.vtt` returns `200`.

Do not say transcoding or transcription completed just because the job/workflow was triggered.

## Import

1. Start at the repo root and check for unrelated work:

```bash
jj status
```

Preserve unrelated user changes.

2. Before running dependency installs, Bun workspace commands, tests, or generated CI checks, synchronize the workspace from the repository root:

```bash
cuenv sync -A
```

3. Extract the video ID from the YouTube URL. For `https://www.youtube.com/watch?v=tKc8Rna3vDQ`, use `tKc8Rna3vDQ`.

4. Check importer state:

```bash
cd projects/rawkode.academy/tasks/video-importer
cuenv exec -e production uv run python youtube_to_r2.py <youtube-id> --show-state
```

5. Run the importer:

```bash
cuenv exec -e production uv run python youtube_to_r2.py <youtube-id>
```

If the user already downloaded the video, find the file and pass it explicitly:

```bash
find /Users/rawkode/Downloads -maxdepth 1 -type f \( -iname '*.mp4' -o -iname '*.mkv' -o -iname '*.mov' -o -iname '*.webm' \) -print
cuenv exec -e production uv run python youtube_to_r2.py <youtube-id> --local-video /absolute/path/to/video.mp4
```

The importer downloads or prepares the video, extracts MP3 audio, uploads `original.mkv`, `original.mp3`, and `thumbnail.webp` to `rawkode-academy-content`, triggers Cloud Run `transcoding-job` (unless `--skip-cloud-run`), inserts the video row into the `platform-videos` D1 database, calls the website's cache invalidation endpoint for `videos:<cuid>`, and prints the CUID plus the SQL it wrote. The row holds `title`, `subtitle` (first description line), `slug` (from the title), `description` (plain text), `description_doc` (the same text as a TipTap document), `duration`, `publishedAt` (YouTube upload date, Unix seconds), `youtube_id` and `updated_at`. An existing row is never overwritten.

D1 needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (provided by `cuenv exec -e production`). `CACHE_INVALIDATION_TOKEN` is optional: without it the importer warns, leaves `cache_invalidated` incomplete, and the website shows the video after its hourly change detection.

The row makes the video public at `publishedAt` (usually already past), before transcoding finishes. To hold it back, run with `--skip-d1` (uploads only, SQL printed), then re-run the same command without it once transcoding completed: completed steps are skipped, so the re-run only writes D1 and invalidates the cache. The downloaded JPEG thumbnail is only a temporary conversion source; `thumbnail.webp` is the canonical runtime asset. It keeps state in `~/.youtube_to_r2_state/<youtube-id>.json`.

If a turn is interrupted, poll the running session if available before starting a new import. Avoid duplicate uploads for the same YouTube ID.

6. Verify import/upload:

```bash
jq '{cuid, completed_steps, artifacts, title: .video_info.title, duration: .video_info.duration, upload_date: .video_info.upload_date}' /Users/rawkode/.youtube_to_r2_state/<youtube-id>.json

curl -fsS -I https://content.rawkode.academy/videos/<cuid>/original.mkv
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/original.mp3
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/thumbnail.webp
```

If an older import has both `thumbnail.jpg` and `thumbnail.webp`, remove the JPEG after verifying WebP:

```bash
cd projects/rawkode.academy/tasks/video-importer
cuenv exec -e production uv run python migrate_thumbnails_to_webp.py --video-id <cuid> --workers 1
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/thumbnail.webp
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/thumbnail.jpg # should return 404
```

## Content (D1 rows)

The repository has no content files any more (the `content/` tree is gone); never create Markdown/MDX/YAML for videos, people or technologies. The importer creates the `videos` row; everything else is rows in the platform services under `projects/rawkode.academy/platform/<service>` (exact columns in each `data-model/schema.ts`). Apply SQL with wrangler from the service directory:

```bash
cd projects/rawkode.academy/platform/<service>
cuenv exec -e production -- bunx wrangler d1 execute <database> --remote --config read-model/wrangler.jsonc --file=/absolute/path/to/change.sql
# or --command "SELECT ..." to read
```

Write SQL files outside the repo, double single quotes inside string literals, store JSON columns as JSON text, and set `updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000` on tables that have it. Match conventions from nearby videos (read them from the API or D1) for slugs, types, categories and resources.

| What | Database (`service`) | Table and columns |
|---|---|---|
| Video metadata | `platform-videos` (`videos`) | `videos`: `slug` (drop show suffixes like `-rawkode-live` unless nearby videos keep them), `subtitle`, `tagline`, `type` (`live`/`recorded`), `category` (`editorial`/`tutorial`/`review`/`interview`/`announcement`), `what_you_will_learn` (JSON string array), `resources` (JSON array of `{title, description?, type: url\|file\|embed, url?, category: slides\|code\|documentation\|demos\|other}`), `description` + `description_doc` |
| Show episode | `platform-episodes` (`episodes`) | `episodes`: `videoId`, `showId` (e.g. `rawkode-live`, `cloud-native-compass`), `code` (unique per show; the episode code or the video slug) |
| Guests | `platform-video-guests` (`video-guests`) | `video_guests`: `video_id`, `guest_id` (person id), `position` (credit order from 0) |
| Technologies | `platform-video-technologies` (`video-technologies`) | `video_technologies`: `video_id`, `technology_id` (no `/index`), `position` |
| Chapters | `platform-chapters` (`chapters`) | `chapters`: `video_id`, `seconds`, `title` |
| Transcription terms | `platform-transcription-terms` (`transcription-terms`) | `transcription_terms`: `kind` (`video`, `episode`, `person`, `technology`, `show`), `foreignId` (the entity id; for an episode `<showId>-<videoId>`), `term` |

Example (`platform-videos`):

```sql
UPDATE videos SET slug = '<slug>', type = 'live', category = 'tutorial', updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE id = '<cuid>';
```

```sql
-- platform-episodes
INSERT INTO episodes (videoId, showId, code) VALUES ('<cuid>', 'rawkode-live', '<slug>');
-- platform-video-guests
INSERT INTO video_guests (video_id, guest_id, position) VALUES ('<cuid>', '<person-id>', 0);
-- platform-video-technologies
INSERT INTO video_technologies (video_id, technology_id, position) VALUES ('<cuid>', 'kubernetes', 0), ('<cuid>', 'helm', 1);
```

### People

If a guest is missing, create them before referencing them. The id is the GitHub handle when they have one (for example `davidmdm`).

- `platform-people` (`people`), table `people`: `id`, `forename`, `surname`, `name` (display name), `github`, `twitter`, `bluesky`, `linkedin` (handles), `mastodon`, `website`, `youtube` (full URLs), `updated_at`. The avatar comes from the GitHub handle.
- `platform-people-biographies` (`people-biographies`), table `people_biographies`: `person_id`, `biography` (Markdown), `biography_doc` (TipTap JSON). Only when there is a biography.
- `platform-people-links` (`people-links`), table `people_links`: `person_id`, `url`, `name`, `position`.
- Transcription spellings of their name: `transcription_terms` with `kind = 'person'`.

### Technologies

If the video references a missing technology, create it with the `tech` skill (`platform-technologies` row, logos in R2 at `rawkode-academy-content/technologies/<id>/{icon,horizontal,stacked}.svg`) before inserting `video_technologies` rows. Keep it concise and use primary project sources.

### Rich text

`description_doc`, `biography_doc` and technology `body` are TipTap/ProseMirror JSON (`@rawkodeacademy/rich-text`). Write the text as Markdown, store it in the Markdown column (`description`, `biography`), and generate the document from it; never hand-write the JSON:

```bash
cd packages/rich-text
bun -e 'import { fromMarkdown } from "./src/markdown/index.ts"; import { validateDoc } from "./src/schema.ts"; const file = process.argv[1]; const doc = fromMarkdown(await Bun.file(file).text(), { mdx: false, file }); validateDoc(doc); console.log(JSON.stringify(doc));' /absolute/path/to/description.md
```

### Invalidate the website cache

After every D1 write that the importer did not make, invalidate the tags of every entity you changed (`videos:<cuid>`, `people:<id>`, `technologies:<id>`, `shows:<id>`); the endpoint adds the collection tags:

```bash
curl -fsS -X POST https://rawkode.academy/api/cache/invalidate \
  -H "Authorization: Bearer $CACHE_INVALIDATION_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"tags":["videos:<cuid>","people:<id>"]}'
```

`just invalidate-content '{"tags":["videos:<cuid>"]}'` in `projects/rawkode.academy/website` does the same. It answers after about 50 seconds (two purges); `502` means retry. Without the token, say that the change appears after the hourly change detection.

## Transcoding

The importer triggers transcoding but does not prove it completed.

Check the public HLS playlist first:

```bash
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/stream.m3u8
```

If it is `404`, check Cloud Run executions:

```bash
gcloud run jobs executions list \
  --job=transcoding-job \
  --region=europe-west2 \
  --project=rawkode-academy-production \
  --limit=10 \
  --format=json
```

Find the execution whose container env has `VIDEO_ID=<cuid>`.

- `status.conditions[]` with `type: Completed`, `status: True` means transcoding completed.
- `status.runningCount: 1` and `Completed` status `Unknown` means it is still running.
- `Completed` status `False` or failed task counts mean it failed; inspect the execution logs before retrying.

## Transcription

The YouTube importer does not trigger transcription. The transcription service is `projects/rawkode.academy/platform/transcriptions`, a Cloudflare Worker with a Cloudflare Workflow named `transcribe`.

Before scheduling transcription, make sure the live API can resolve the video, because the workflow calls `https://api.rawkode.academy`:

```bash
curl -fsS https://api.rawkode.academy \
  -H 'Content-Type: application/json' \
  --data '{"query":"query($id:String!){ videoByID(id:$id){ id title streamUrl thumbnailUrl } }","variables":{"id":"<cuid>"}}'
```

Trigger transcription:

```bash
cd projects/rawkode.academy/platform/transcriptions
cuenv exec -e production bun scripts/schedule_one.ts <cuid> en
```

Do not pass manual keyterms on the CLI. Transcription keyterms are derived from live content metadata: video `title`/`terms`, episode `code`/`terms`, show `name`/`terms`, guest `name`/`terms`, and technology `name`/`terms`. Terms are `transcription_terms` rows (see Content); add them, and the episode/guest/technology rows, before scheduling, because the workflow queries `https://api.rawkode.academy`.

Check workflow state:

```bash
cuenv exec -e production bunx wrangler workflows instances list transcribe
cuenv exec -e production bunx wrangler workflows instances describe transcribe <workflow-id>
```

Check artifacts:

```bash
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/transcription/deepgram.json
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/captions/en.deepgram.vtt
curl -fsS -I https://content.rawkode.academy/videos/<cuid>/captions/en.vtt
```

`captions/en.vtt` is the final caption file used by watch pages.

Known transcription states:

- `Completed` plus `captions/en.vtt` returning `200` means transcription is done.
- `Waiting` can mean the workflow is between retries; run `describe` for the exact step error.
- Transcription uses Cloudflare Workers AI `@cf/deepgram/nova-3`, not a direct Deepgram API key. If `ASR_PAYMENT_REQUIRED` appears, the old direct-Deepgram worker is still running; deploy the current worker and start a fresh workflow.

## Episode Description

Only review the transcript after `captions/en.vtt` exists. Fetch the VTT, skim the major topic flow, then update the video description to be concise and production-facing: write it as Markdown, convert it (see Rich text), `UPDATE videos SET description = '<markdown>', description_doc = '<json>', updated_at = ... WHERE id = '<cuid>'` in `platform-videos`, and invalidate `videos:<cuid>`. Prefer direct summaries over YouTube boilerplate. Keep resources grounded in links mentioned in the episode or obvious primary project links.

Treat generated captions as evidence for the description, not proof that the transcript was manually copyedited. If the VTT still has ASR rough edges, say so plainly unless you actually cleaned and re-uploaded the transcript.

## Validation

Check the API and the page, after invalidating the cache:

```bash
curl -fsS https://api.rawkode.academy/ -H 'content-type: application/json' \
  --data '{"query":"query($id:String!){ videoByID(id:$id){ id slug title type category publishedAt descriptionDoc episode { code } guests { id } technologies { id } } }","variables":{"id":"<cuid>"}}'
curl -fsS -o /dev/null -w '%{http_code}\n' https://rawkode.academy/watch/<slug>
```

Every referenced guest and technology must resolve (no nulls in `guests`/`technologies`).

Always report blocked or in-flight work plainly: uploaded, transcode running, transcription waiting, captions missing, etc.

---
name: rawkode-academy-video-importer
description: "Import YouTube videos into Rawkode Academy: run the video-importer, upload R2 assets, verify transcoding, trigger and verify transcription, create content/videos entries, and avoid claiming triggered jobs are complete before artifacts exist."
---

# Rawkode Academy Video Importer

Use this skill when importing a YouTube video into `rawkode-academy` content, especially when the task mentions `projects/rawkode.academy/tasks/video-importer`, R2 uploads, transcoding, transcription, captions, or episode descriptions.

## Critical Rule

Separate evidence for each stage:

- Import/upload complete means the importer state has `completed` and the original R2 assets return `200`.
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

The importer downloads or prepares the video, extracts MP3 audio, uploads `original.mkv`, `original.mp3`, and `thumbnail.webp` to `rawkode-academy-content`, triggers Cloud Run `transcoding-job`, and prints the CUID plus SQL metadata. The downloaded JPEG thumbnail is only a temporary conversion source; `thumbnail.webp` is the canonical runtime asset. It keeps state in `~/.youtube_to_r2_state/<youtube-id>.json`.

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

## Content

Create the content file from importer output and nearby entries:

- Path: `content/videos/shows/<show>/<year>/<slug>.md`
- `id`: importer CUID
- `slug`: clean show suffixes like `-rawkode-live` unless nearby entries keep them
- `publishedAt`: YouTube upload date as ISO UTC if no better timestamp exists
- `duration`: importer duration in seconds
- `show`: matching show ID, commonly `rawkode-live` or `cloud-native-compass`
- `type`, `category`, `technologies`, `guests`, `resources`: match nearby entries

If a guest is identified by GitHub handle, use the handle for both filename and `id`, for example `content/people/davidmdm.mdx` with `id: davidmdm`.

If the video references a missing technology, add `content/technologies/<id>/index.mdx` before referencing it. Keep it concise and use primary project sources.

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

Do not pass manual keyterms on the CLI. Transcription keyterms are derived from live content metadata: video `title`/`terms`, episode `code`/`terms`, show `name`/`terms`, guest `name`/`terms`, and technology `name`/`terms`. If those GraphQL fields or content metadata changed locally, deploy the website/API before deploying or running the transcription Worker, because the workflow queries `https://api.rawkode.academy`.

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

Only review the transcript after `captions/en.vtt` exists. Fetch the VTT, skim the major topic flow, then update the video description to be concise and production-facing. Prefer direct summaries over YouTube boilerplate. Keep resources grounded in links mentioned in the episode or obvious primary project links.

Treat generated captions as evidence for the description, not proof that the transcript was manually copyedited. If the VTT still has ASR rough edges, say so plainly unless you actually cleaned and re-uploaded the transcript.

## Validation

Run the website content/type check:

```bash
cd projects/rawkode.academy/website
bun run astro check
```

If sandboxed execution fails with `listen EPERM` for the Cloudflare/Vite inspection port, rerun with approval. Existing Vite dependency-scan noise can appear; use the final exit code and Astro diagnostic summary.

Always report blocked or in-flight work plainly: uploaded, transcode running, transcription waiting, captions missing, etc.

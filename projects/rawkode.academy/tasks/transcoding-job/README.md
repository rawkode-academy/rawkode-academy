# transcoding-job

Cloud Run job `transcoding-job` (project `rawkode-academy-production`, region `europe-west2`). `platform/studio-recording-ingest` starts one execution for every Studio `ready.json` marker; the video importer starts it for imported videos.

## Output modes

`OUTPUT_MODE` is set by the ingest Worker from the marker contract.

| Mode | Marker | Reads | Writes |
| --- | --- | --- | --- |
| `hls` (default) | v1 | `SOURCE_KEY`, or `videos/{id}/original.mkv` | `videos/{id}/`: HLS renditions, `original.mp3`, the source and `original.mkv`, `transcode-status.json`. Unchanged. |
| `review-proxy` | v2, `visibility: "review"` | `SOURCE_KEY` with `If-Match: SOURCE_ETAG` | One private `studio/recordings/{s}/{r}/review/{execution}-a{attempt}/review.mp4` (720p H.264/AAC, fast start, `If-None-Match: *`), then `review/transcode-status.json` with a `review` block. |
| `hls-approved` | v2, `visibility: "public"` | `SOURCE_KEY` with `If-Match: SOURCE_ETAG` | `videos/{id}/`: HLS renditions, `original.mp3` and `transcode-status.json`. The source and `original.mkv` stay in a private `work/` directory and are never uploaded. |

`review-proxy` fails early when the source is larger than `MAX_REVIEW_SOURCE_BYTES` (default 8 GiB) and when the proxy is larger than 5 GiB, the single PutObject limit.

## Resources and timeout

Run `just configure-job` after changing these values. The ingest Worker also sends `timeout: 10800s` as a per-execution override, so the timeout holds even if the job default drifts.

| Setting | Value |
| --- | --- |
| CPU | 8 |
| Memory | 32 GiB |
| Task timeout | 10800 s (3 hours) |
| Retries | Unchanged: `configure-job` leaves the job's existing retry count alone, so routine VOD and importer runs keep Cloud Run's automatic task retries. |

Every mode is safe to retry: `review-proxy` writes to a key scoped by execution and attempt with `If-None-Match: *`, and the HLS modes re-sync the same prefix. Each attempt rewrites `transcode-status.json` with a fresh `startedAt`. A run killed from outside (task timeout, out of memory, a container that never starts) leaves its status at `queued` or `running`; Payload reports a Studio review transcode in that state for more than 4 hours as failed, and Studio's promotion watchdog treats an `hls-approved` run the same way. Studio then rewrites the marker with `transcodeAttempt + 1`, at most 3 times per take.

`hls-approved` also publishes `original.mp3`. It is cut from the approved source (never from an unapproved take) and is part of the public rendition: the podcast feed and the transcription workflow read `videos/{id}/original.mp3` for every published video.

These values are sized for a two hour 720p recording. They are estimates, not measurements: Release Gate 4 (a full-length private handoff) must record the real numbers here. Cloud Run's filesystem is memory-backed, so every file on disk counts against memory.

| Two hour recording | `review-proxy` | `hls` / `hls-approved` |
| --- | --- | --- |
| Source (browser WebM at 2.5 to 5 Mbps) | 2.3 to 4.5 GB | 2.3 to 4.5 GB |
| Other files on disk | proxy at most 2.5 Mbps video and 128 kbps audio: about 2.4 GB | `original.mkv` copy 4.5 GB, renditions (720p 5 Mbps, 480p 2.5 Mbps, 360p 1 Mbps) 7.6 GB, MP3 0.2 GB |
| In-memory download buffer | none (streamed) | 4.5 GB for `hls` only (`downloadFromS3` buffers the object); none for `hls-approved` |
| Peak memory | about 8 GB with ffmpeg | about 21 GB (`hls`), 17 GB (`hls-approved`), plus 2 to 3 GB for three parallel ffmpeg encodes |
| Wall time on 8 vCPU | 25 to 40 minutes (one 720p `veryfast` encode at 5 to 10 times real time) | 60 to 100 minutes (three parallel encodes, then about 8 GB uploaded) |

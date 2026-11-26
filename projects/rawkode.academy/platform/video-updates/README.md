# Video updates

A Cloudflare Worker that changes a video and everything attached to it in one operation, then tells the YouTube sync. Workflow `update-video`, Worker `platform-video-updates`.

## What an update can change

One request is a patch for one video. A section left out is untouched; a section given replaces what is stored, in the order given.

| Section | Writes | Database |
| --- | --- | --- |
| `video` | title, subtitle, tagline, slug, description (Markdown; the rich-text document is generated), what you will learn, published at, type, category, course only, resources (links) | `platform-videos` |
| `people` | upsert people and their profile links | `platform-people`, `platform-people-links` |
| `credits` | casting credits (`host`, `co_host`, `guest`, `author`) | `platform-casting-credits`, plus `platform-video-guests` (see below) |
| `technologies` | ordered technology ids | `platform-video-technologies` |
| `chapters` | `{seconds, title}` list | `platform-chapters` |
| `show` | `{showId, code}` or `null` | `platform-episodes` |
| `courseModule` | the lesson (`<course>/<slug>`) this video plays in, or `null` | `platform-courses` |
| `collaborations` | collaborators, window and tracked link | `platform-video-collaborations` |
| `channels` | YouTube, X or LinkedIn ids | `platform-video-channels` |

`video_guests` is still read by the website's person pages, so guest credits are mirrored into it. Drop that step (`legacyGuests` in `src/sections.ts`) with the last reader.

## Not a transaction

These are separate D1 databases, so nothing spans them. Instead:

1. **Validate** (reads only): the video exists, the slug is free, every person, technology, show, lesson and collaborator exists, the episode code is free, no duplicates. A bad request is `rejected` and nothing is written.
2. **Save** the current rows of every database the update will touch (stored in this Worker's D1).
3. **Write** one section at a time, each one atomic D1 batch that deletes and re-inserts, so a retried step is safe.
4. If a write fails after its retries, **restore** every section already written from the saved rows, in reverse. The update ends `rolled_back`, or `rollback_failed` if a restore itself fails, which the monitor reports.
5. After the last section commits: **publish** `video.updated` to the queue `platform-video-updated`, **invalidate** the website cache (`videos:`, `people:`, `shows:`, `technologies:` tags), and record an event in the lake. None of these undo the update. A lost event is caught by the YouTube sync's daily diff.

One update per video at a time (a second is refused while the first runs). A repeated `requestId` returns the same update.

## Calling it

There is no public write endpoint. `VideoUpdates` is a `WorkerEntrypoint` reached by service binding, with `preview(request)`, `update(request, actor)` and `status(updateId)`. The Rawkode Tools MCP (operators, signed in with Rawkode Academy identity) is the caller and passes who the operator is, which goes in the audit row. `GET /health` and `GET /status` are public and return counts and times only.

## YouTube

The YouTube sync consumes `platform-video-updated`: it re-reads the video from the Academy API, plans just that video (a plan with scope `video`, never the "latest" full plan) and, when something differs, puts it on its normal write queue, so the quota budget, retries, dead letters and the monitor all apply. `PUSH_ON_UPDATE` in its `wrangler.jsonc` turns the push off. The daily full diff stays as the safety net.

## Deploy and alerts

CI on `main` (`rawkode-academy-platform-video-updates-default`) tests, creates the queues if missing and deploys. The only secret is `CACHE_INVALIDATION_TOKEN`, the website's own token, read from 1Password (`op://sa.rawkode.academy/website-cache-invalidation/password`). The audit database `platform-video-updates` is provisioned by Wrangler on first deploy and its table is created on first use. The `video-updates-monitor` workflow runs hourly and opens an issue for rolled-back, stuck or unpublished updates.

```sh
cuenv task check
cuenv task test
```

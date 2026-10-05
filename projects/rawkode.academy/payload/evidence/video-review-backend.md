# Video review backend contract

This additive backend preserves the captured public GraphQL schema. It does not deploy, change DNS, run transcription/encoding, replace the website content loader, or provide a review UI.

## Runnable scope and media gate

Staff upload originals and review deliverables through the existing authenticated `/api/media` upload API. Each revision references two distinct immutable media records; the original remains private. All verification reads are bounded to 32 MiB.

**Arbitrary media cannot enter this review/publish flow yet.** The runtime requires a trusted deliverable probe. The only implemented probe is the exact checked-in `fixtures/synthetic.mp4` SHA-256, enabled only with `POC_REVIEW_FIXTURE_MEDIA=true` and the loopback OIDC origin. Its H.264/AAC streams, 1000 ms duration, and full decode were checked locally. Outside that explicit fixture mode, revision creation fails with 503. Caller MIME and duration do not establish playability. Real media requires a trusted probe/processing adapter returning verified checksum, duration and content type; that adapter is deliberately a remaining gate.

Uploads themselves remain staff-only and private when rejected by the review gate. Upload-intent binding, large/resumable uploads and orphan-upload cleanup are follow-ups.

## Commands and reads

`GET /api/review?videoId=<numeric Payload video ID>` returns a private, no-store DTO with current revision, all revisions, comments, decisions and resolution history. Staff additionally see grant records. Clients must have an active grant for this video. Source keys, checksums, raw Payload identity records and grants are omitted from client DTOs.

`POST /api/review` requires an authenticated same-origin session, `Content-Type: application/json`, and at most 256 KiB. Every command requires `videoId` and a fresh UUID `commandId`. Exact retries by the same actor return their saved result; conflicting reuse returns 409. Authorization is checked before replay.

| action | Additional fields | Authorization / behavior |
| --- | --- | --- |
| `create-revision` | `mediaId`, `deliverableMediaId`, `metadata`, optional `durationMs` assertion | Staff. Server-verified duration is authoritative. Source/deliverable identity never changes. Creates a new current cut, preserving prior cuts and publication. |
| `grant` | `userId`, `canApprove` | Staff, existing customer account. Each grant change advances its epoch. |
| `revoke` | `userId` | Staff. Access ends; regranting never resurrects an earlier approval. |
| `edit` | `revisionId`, `expectedReviewVersion`, `metadata` | Staff, current unapproved revision. Increments review version and clears a changes-requested decision. |
| `comment` | `revisionId`, `startMs`, optional `endMs`, `body` | Assigned client or staff; any retained cut. Integer timestamps must fit its verified duration. Body is plain text, never HTML. |
| `resolve-comment` | `commentId`, `resolved` | Assigned client may resolve/reopen their own comments; staff may manage any comment. Stores resolver, time and append-only history. |
| `decide` | `revisionId`, `expectedReviewVersion`, `decision`, optional `note` | Assigned client with `canApprove`; decision is `approved` or `changes-requested`. Approval is final for the revision. |
| `publish` | `revisionId`, `expectedReviewVersion`, `decisionId` | Staff. Requires current approval, unchanged grant epoch, no unresolved comments on this cut, and matching verified source/deliverable bytes. |

`metadata` contains `title`, `description`, optional `transcript`, and optional ordered `chapters: [{title,startTime}]`. Chapter times are integer seconds for the existing GraphQL Int contract. Comment timestamps are integer milliseconds. Approved and published revisions cannot be edited or re-decided; create a new revision, even for another review round over the same uploaded media.

Private playback is `GET`/`HEAD /api/review/media?videoId=...&revisionId=...`. It checks the current grant and the recorded deliverable checksum, then serves an ETag-conditional byte range with private/no-store caching. The bounded fixture implementation rehashes the object for each request; large-media optimization is deferred.

## Publication and persistence

D1 batches atomically commit a generation precondition, domain writes, command journal and result. Failed preconditions raise a CHECK constraint error and roll back the whole batch. All grant/comment/decision changes advance the same per-video generation, including concurrent changes during media verification. SQL triggers freeze managed base video rows, draft/version rows, relationship/array children, and legacy pipeline writes. Existing legacy pipeline videos cannot enroll. Generated collection APIs expose staff read-only review records and deny all direct mutations.

Publication first conditionally writes private immutable release bytes under `review-releases/<video>/<command>/<checksum>.mp4`. It verifies existing bytes on retry and retains the ETag of that exact verification. The D1 batch then commits the public projection, immutable publication event and published state together. The public media route only serves committed publication keys, verifies the recorded ETag/size, and never resolves a mutable upload filename. Failed D1 commands can leave unreachable private release objects; garbage collection is deferred.

`video-publications` contains only whitelisted public catalogue data. Catalogue overlays these committed snapshots on legacy public records without replacing legacy IDs. Chapters live in the snapshot so partial public chapter creation is impossible. Public playback URLs point to the committed release endpoint; originals and review conversations remain private. Previously published release URLs remain public when a later cut is released; takedown/retention is a separate future capability.

Generated `/api/videos` remains the original catalogue record and does not materialize the new public projection. Consumers for this slice must use compatibility GraphQL or `video-publications`. The existing Astro watch page does not yet consume this release path.

The migration adds tables/triggers without rewriting existing content. The companion JSON snapshot is generated from current Payload collections without a database connection. Raw command/history tables and trigger constraints are intentionally managed by the handwritten migration. Future migrations must preserve them. Empty downgrade is supported; downgrade refuses after any video enrolls to preserve review history. Existing publications are not invented/backfilled as client approvals.

## Verification boundary

Tests exercise real SQLite migrations with foreign keys, D1 batch-equivalent transactions, service commands, HTTP validation, collection access functions, public GraphQL projection, and fake R2 failure/race cases. They do not establish a deployed Worker, live OIDC login, browser playback, or real R2 integration.

Implementation verification: `tsc --noEmit --incremental false` passed; the package regression command passed 84 tests, including 17 focused review tests. Independent read-only diff review found no remaining code blockers. `cuenv sync -A` was attempted first but failed: host CLI 0.53.2 versus schema 0.55.1, and a CUE registry 401. Locked Bun installation was blocked by missing workspaces in this pruned checkout; checks used a local symlink to already-installed Payload dependencies without editing that source checkout. No Worker deployment, production migration or DNS operation was performed.

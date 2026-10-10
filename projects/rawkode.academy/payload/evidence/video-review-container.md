# Review Container boundary — implementation and Preview evidence

This slice implements the FFmpeg runner, native Cloudflare Container Durable Object bridge, and durable review Workflow activation. The implementation is deployed in the non-production `rawkode-academy-payload-review-runtime` Worker and was exercised against the named `pr-local` Preview with the checked-in synthetic MP4. This is Preview evidence, not production readiness evidence.

## Runtime and integrity

- The native `ctx.container` bridge uses explicit default scheduling, disables Container internet access, bounds health polling, and requires a baked recipe identity. The runner receives pinned source bytes and a fixed job manifest, without R2 credentials, caller-controlled destinations, arbitrary URLs or executable arguments.
- Real media is probed and fully decoded; unsupported and externally referenced formats are rejected. H264/AAC fast-start output is probed and fully decoded. Audio extraction produces valid mono 16 kHz PCM WAV chunks for Whisper.
- Bounds: 64 MiB input/output, two-hour duration, 120 one-minute audio chunks of at most 2 MiB, geometry/frame rate, logs/probe output, scratch reservations and file-growth checks. The 105-second whole-request deadline means the two-hour admission bound is not a completion guarantee.
- Strict framing, server-derived R2 keys, fixed-length/SHA-256 conditional writes, cancellation/deadline rechecks, duplicate coalescing and persistent job/operation identity protect the bridge. The expected report is saved before uploads. Receipt-loss retries may recompute but must reproduce that report; existing objects are verified and never overwritten. A complete framing check remains required before saving a receipt.
- The request runtime installs the Workflow adapter with the Workflow binding and exact compiled recipe; the Workflow host owns AI and Container bindings. Both Wrangler configs and the production config's preview section have structural Container/DO bindings. Existing remote AI settings are preserved.
- Linux amd64 Node and static FFmpeg binary-bearing image manifests are pinned. Recipe `8a93818133f7c9f7959ac624197b008b6146aaedde3d0a499149d7c380378fcf` covers the Dockerfile and executable modules. Production startup verifies their hashes; `build:worker` checks recipe drift.

## Verification on 2026-10-05

- Full Payload regression suite: **154 tests passed**, including **46 bridge/protocol checks** for concurrent calls, crash after each audio write, immutable retry plans, lost acknowledgements, cancellation, integrity replacement, malformed frames, audio coverage and activation. Fake protocol fixtures are not claimed to be playable media.
- Host `node --test container/runner.test.mjs`: **16/16 passed**, using FFmpeg 7.0 and ffprobe 9.0.1. Includes real MP4/WebM/QuickTime, deterministic H264/AAC encoding, valid WAV extraction, corruption, external references, deadline/disconnect, resource bounds and recipe tampering.
- Payload `tsc --noEmit --incremental false`, recipe drift check and `git diff --check`: passed.
- Wrangler 4.147.0 `types --include-runtime=false`: both configurations passed structural validation, including the Container/DO declarations. This is not a deployment check.
- The pinned Linux image built. Local tag `rawkode-review-ffmpeg:ab74d9377bb0`; manifest-list digest `sha256:d4d430d1358ce2f49ee07a188fc52917122a3d0c2da9f282f2c11147b241792e`. Node startup reported v24.21.0. No registry image was published.
- Docker's test-file bind mount from the isolated checkout under Documents stalled before a container appeared; that client was terminated. Passing the test module through stdin avoided the mount. The network-disabled, read-only, resource-limited amd64 image passed **14/16 checks**, including all real-media encode/decode, deterministic retry, WAV, WebM/QuickTime and external-reference cases. Two synthetic temporary-executable tests returned 503 (executable unavailable) instead of expected 408 timeout or 422 nonzero-exit responses. The cause was not further diagnosed; the complete image suite is not green. Those checks pass on the host. No workaround remains running.
- Independent read-only adversarial review supported the persistent non-production Workflow host and explicit Preview `script_name` binding. Its bounded health-response recommendation was implemented. The hosted lifecycle then completed successfully; see [hosted end-to-end evidence](video-review-hosted-e2e.md).
- Required `cuenv sync -A` was attempted before tests, but failed on existing CLI/schema mismatch, missing pruned checkout rules and CUE registry 401. No dependency install or cuenv repair was performed.

## Remaining gates

Verify the production entrypoint and complete failure-path suite in the target image/runtime before claiming production readiness. The named Preview has established native Container lifecycle, durable persistence, Workflow retries, R2 streaming, Whisper output, and end-to-end review attachment/playback for the synthetic fixture. Arbitrary footage, production deployment, public DNS, quotas/cost controls, and public watch-page integration remain unverified.

API/configuration references: https://developers.cloudflare.com/containers/api/durable-object-container/ and https://developers.cloudflare.com/containers/get-started/ , checked against the installed Wrangler schema.

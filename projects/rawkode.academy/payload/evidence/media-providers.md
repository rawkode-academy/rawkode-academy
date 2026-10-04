# Target media providers and remaining acceptance gates

Status: proposed cloud adapters, official documentation checked 2026-10-04. The POC runs native Cloudflare Workflows locally on workerd, with D1 and R2 bindings. Its transcription, encoding and enrichment processors are deterministic fixtures. Uploading a genuine synthetic MP4 does not establish AI transcription or video encoding. The current encoding output explicitly says `encoded: false` and `playable: false`.

The local test's timestamp, runtime probe and assertions are saved in `pipeline-tests.json` when `node --import tsx scripts/test-pipeline.ts` succeeds. No cloud deployment, live Workers AI inference, Container invocation or customer media processing is claimed.

## Intended providers

| Responsibility | Intended service | Required output |
| --- | --- | --- |
| Probe, audio extraction, chunking, video encoding | Cloudflare Containers or Sandbox with a pinned ffmpeg/ffprobe image | Probe metadata, bounded audio chunks, renditions, thumbnails and checksummed artifact manifest |
| Speech recognition | Workers AI `@cf/openai/whisper-large-v3-turbo` | Source-language transcript, timed segments and captions mapped to the source timeline |
| Summary, chapter suggestions and metadata | Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Validated structured suggestions with transcript evidence and model/prompt provenance |
| Durable coordination | Cloudflare Workflows; Queues only where independently justified for ingestion/fan-out | Retryable steps, bounded parallelism, completed artifact references and explicit failure state |
| Editorial decision | Payload plus custom approval command | Human-reviewed revision bound to an immutable source version and processing manifest |

Cloudflare documents the Whisper model as an ASR model, accepting audio and returning text, segments and VTT. Record the exact deployed input/output schema and validate its audio limits before implementing the adapter; do not assume the fixture transcript represents that schema. [Whisper model documentation](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/).

The selected Llama model is documented for text generation, with a 24,000-token context window. Long Academy recordings therefore need a measured token budget and hierarchical summarization rather than passing an entire transcript without checking its size. Model availability and limits must be reconfirmed at deployment. [Llama model documentation](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/).

## Processing and storage contract

1. Accept a private upload; finish the object write, record byte length, calculate SHA-256 and register an immutable video version. Bind the orchestration identity to video version, checksum and processing recipe version. A new cut creates a new version.
2. Probe with ffprobe inside the pinned Container/Sandbox image. Capture duration, dimensions, codec, audio streams, rational frame rate and source timebase. Extract audio to local scratch storage. Chunk at measured duration/byte limits, preserving exact source offsets, overlap and chunk checksums in an R2 manifest. The chunk size is a configuration to validate against the live provider, not a guessed constant in this POC.
3. Fork transcription and video encoding after successful probe/extraction. Submit bounded transcription work; merge returned timestamps by source offset and remove overlap duplicates deterministically. Record empty/silent audio, language uncertainty and per-chunk errors explicitly. Never substitute fabricated text for failed ASR.
4. Encode/probe in the Container/Sandbox, not inside a CPU-bound Worker request. Write outputs under an immutable run prefix. Validate duration, audio/video synchronization, codecs and seekability before writing the final manifest. Intermediate objects remain private and are not marked playable.
5. Join only when transcription and encoding manifests both match the registered source checksum/version. Summarize transcript sections, then reduce their summaries into validated metadata and chapter suggestions. Reject chapter times outside duration or out of order. Keep model output as an editorial suggestion; transcript instructions are untrusted content and do not authorize actions.
6. Deliver a signed/authenticated machine result to Payload. Present the source version, generated material and manifest revision for human review. Edits produce a new approval revision. Publish only through an explicit approval command; reject stale approvals and keep private media access separate from catalogue publication.

Containers support non-JavaScript workloads and greater compute/memory resources than Workers, making ffmpeg a sensible target workload; the image and codec configuration still need a deployment proof. [Cloudflare Containers overview](https://developers.cloudflare.com/containers/).

For a Sandbox implementation, use the current R2 mount/file-transfer guidance and validate object-store I/O explicitly. Pin the SDK API version; older SDK 0.x mount examples are not a validated template for a new SDK implementation. Prefer bounded scratch files and explicit artifact uploads where encoding requires random access or frequent small writes. [Current Sandbox R2 documentation](https://developers.cloudflare.com/sandbox/files/mount-an-r2-bucket/).

## Retries, recovery and approval

Workflows provides persisted steps and configurable retries. The local POC exercises these capabilities with a fail-once fixture step and parallel branches; it does not prove real provider timeout behavior. [Cloudflare Workflows API](https://developers.cloudflare.com/workflows/build/workers-api/).

Use a per-stage idempotency key including immutable source identity, processing recipe, model name, prompt version and chunk identity where applicable. Reuse verified completed artifacts. Retry transient failures with capped backoff; surface invalid input and exhausted retries for intervention. Assume delivery can repeat. A duplicate callback must not overwrite human edits, and a duplicate approval must not publish another version.

The current POC targets serialized local operation. Before concurrent production processing, implement durable exclusion or compare-and-swap rules for version registration, machine completion and approval; verify recovery at every multi-write boundary. Keep tokens out of job payloads, object metadata and logs. The dedicated callback secret belongs in deployment secrets and is distinct from the Payload session secret.

## Go/no-go before real customer media

- Deploy an explicitly isolated cloud environment and verify Workers AI bindings, paid-resource availability, Container/Sandbox image execution and private R2 I/O.
- Process a real test recording long enough to cross chunk boundaries; measure transcript accuracy, timestamp drift, multilingual behavior, encoding quality, latency and cost.
- Demonstrate interruption/restart, duplicated work, partial artifact cleanup and provider outage recovery without lost reviews or duplicate publication.
- Play and seek the resulting renditions through authorized delivery; verify revocation and every manifest/segment/caption/thumbnail path.
- Verify human-edited metadata survives callback retries and exact version/revision approvals control publication.
- Define retention for uploads, chunks, derived media, transcripts, manifests and backups. Cost and retention remain unmeasured in this POC.

The current result supports continuing with cloud-adapter experiments. It does not satisfy live AI, live encoding, private playback or production-processing acceptance.

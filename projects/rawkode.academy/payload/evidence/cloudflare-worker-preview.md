# Cloudflare Worker Preview deployment

The Payload preview is deployed with Wrangler's Worker Preview workflow rather than a second production Worker. The `previews` block gives each branch its own Durable Object and Container resources where Cloudflare supports automatic provisioning. The configured D1 database ID and R2 bucket name are currently shared by previews, so preview data is staging data and must not contain production or customer material. Workflows are different: a Preview binds to an already deployed Workflow, so the Workflow names must exist before the media path can be exercised. The media Preview therefore points at the persistent, non-production `rawkode-academy-payload-review-runtime` Worker, which owns the review Workflow, Container, Workers AI, and the named Preview data plane.

References:

- <https://developers.cloudflare.com/workers/previews/get-started/>
- <https://developers.cloudflare.com/workers/previews/resources/>
- <https://developers.cloudflare.com/workers/previews/compare-workflows/>

## Current CI gate

The shared `cloudflare/api-tokens/workers` token can deploy the Worker and provision the data/auth preview, but the first Container-enabled preview attempt returned `403 Authentication error` from `GET /accounts/<account>/containers/me`. This was observed in the Payload PR pipeline on 2026-10-05; no media container was started.

`scripts/deploy-preview.mjs` therefore has an explicit CI fallback controlled by `CLOUDFLARE_PREVIEW_ALLOW_DEGRADED_CONTAINERS=true`. On that exact Containers authentication failure it retries the same named Preview with the container and Durable Object bindings removed. The resulting preview is useful for identity, Payload, D1, R2, and review UI checks; `configuredMediaAdapter()` remains fail-closed, so an upload cannot claim to have been processed without the real providers.

To enable the complete media path, grant the preview deployment token the Cloudflare Containers edit permission, remove the fallback environment variable, and verify the Preview's generated container app starts before accepting a real upload. This is intentionally a deployment prerequisite, not a silent production downgrade.

The host-authenticated Preview used for the hosted synthetic acceptance run had the Containers permission and used the full path. The shared CI token still lacks that permission and may therefore exercise only the explicit data/auth fallback. CI success alone is not evidence that media processing is available.

## PR D2 rendering

PR deployment first keeps the isolated `D2_RENDERER` Container binding so a permitted token can validate Payload's save-time D2 render path. If Cloudflare returns the known Containers permission error, the explicit fallback deploys without Container and Durable Object bindings. The PR import still renders D2 in the Node CI process and seeds checksum-addressed SVGs into that PR's R2 bucket, so the website can validate bridge delivery and SVG rendering. In the degraded fallback, the preview cannot validate the D2 Container image startup, WASM rendering in Cloudflare's Node Container, renderer-to-R2 writes, or CMS saves of documents containing D2; those saves fail closed because `D2_RENDERER` is absent.

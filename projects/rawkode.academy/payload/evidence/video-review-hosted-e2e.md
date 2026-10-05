# Hosted video review lifecycle evidence

The complete synthetic lifecycle was verified against the named Cloudflare Worker Preview on 2026-10-05:

`https://pr-local-rawkode-academy-payload.rawkodeacademy.workers.dev`

The fixture used a disposable Payload video, synthetic Academy staff/customer sessions, and the checked-in small MP4. It was not customer data and did not use the production Worker, production D1/R2, or a custom DNS route.

## Verified path

The hosted runner completed all twelve checks:

1. Staff enumerated the upload target and assigned customer.
2. Staff began an upload and received a durable intake session.
3. The source was stored in the Preview R2 bucket.
4. A Cloudflare Workflow ran encoding and Workers AI transcription in parallel.
5. The verified revision was attached to the video.
6. Staff granted the customer approval access.
7. The customer saw only the granted review and current revision.
8. The customer added a timestamped comment at `00:00`.
9. Staff resolved the comment.
10. The customer approved the exact revision.
11. Staff published only that approved revision.
12. The published artifact served a successful HTTP byte range as `video/mp4`.

Observed processing states were `processing` followed by `ready`. The corresponding Workflow instance was recorded as `complete`.

## Preview topology

Cloudflare Worker Preview does not provision a new Workflow for every Preview. The request Preview therefore binds `REVIEW_MEDIA_WORKFLOW` to the separately deployed, non-production Worker `rawkode-academy-payload-review-runtime` through the explicit `script_name`. That runtime owns the Workflow class, native Container/Durable Object, Workers AI, and the named Preview D1/R2 resources. This keeps the request Worker ephemeral while keeping Workflow identity and durable media processing stable.

The first hosted attempt exposed an implementation issue: Workers fetch accepts `follow` or `manual` redirect handling, not `error`. The Container boundary now uses `manual`, and the fresh-fixture rerun succeeded. The failed disposable fixture remains retained by the job-retention rules; no production data was touched.

## Verification boundary

This proves the deployed Preview workflow and its synthetic media path. It does not prove:

- production Container permission, production Worker deployment, or custom DNS;
- arbitrary customer footage, capacity, quotas, or cost controls;
- live browser OIDC login through a public custom domain;
- migration/import of all existing Academy content;
- replacement of the public Academy watch-page delivery path.

The synthetic fixture and hosted runner are intentionally disposable. Do not treat the named Preview URL as a production service.

# Review upload targets and private thumbnails — local handoff

Verified 2026-10-07 in `/Users/rawkode/Documents/Codex/2026-10-07/what-s-the-status-of-the/payload-fix`. The parent checkout was not modified. Existing dirty work was inspected and retained. At the implementation handoff, no commit, push, PR, deployment, real customer grant, or real video upload had been performed.

## Behavior

Staff can create a private draft video from the review upload panel, optionally upload a thumbnail, then use the existing source intake, checksum/format validation, processing, immutable revision, and customer-grant sequence. Source intake remains capped at 64 MiB. Target creation enforces staff identity, exact configured Origin, bounded JSON, collection access and editorial provenance hooks; caller-supplied pipeline/provenance/publication fields are ignored.

Thumbnail uploads use the existing private Payload Media/R2 collection, with staff/Origin checks, a streamed 5 MiB limit, JPEG/PNG/WebP container and dimension validation, and verification of the stored SHA-256. An immutable `review_thumbnail_assets` row owns each image by video ID. The optional `thumbnailId` is snapshotted through intake metadata into the revision. The thumbnail therefore belongs to **both the video and the immutable revision snapshot**; changing a revision's thumbnail requires a new revision. Old cuts retain their image. Customer GET/HEAD resolves only the authorized revision's image, checks video ownership and object identity, and returns private/no-store responses. It never accepts a customer-selected Media ID or writes the public `thumbnailUrl` field.

Create/upload operations invalidate outstanding searches, capture the intended video/customer/metadata before asynchronous work, and disable overlapping mutations. Native thumbnail inputs reset after completion or clearing a retry.

## Files

Paths below are relative to `projects/rawkode.academy/`, except the GitHub workflows.

- `payload/app/(payload)/api/review/upload-targets/route.ts`, `payload/src/review/staff-http.ts`: POST draft creation and validation.
- `payload/app/(payload)/api/review/thumbnail/route.ts`, `payload/src/review/thumbnails.ts`: private upload and revision-authorized delivery.
- `payload/src/review/{contracts,intake,runtime,service}.ts`: thumbnail ownership validation, snapshot propagation and private poster URLs.
- `payload/src/migrations-cuid2/cuid2_20261007_140000_review_thumbnails.ts`, `payload/src/migrations-cuid2/index.ts`: immutable image associations and guarded rollback in the fresh CUID2 chain.
- `payload/tests/{staff-http,intake,review,thumbnails}.test.ts`, `payload/package.json`: regression coverage and standard test registration.
- `website/review/{bridge,types}.ts`, `website/review/components/{StaffUploadPanel,ReviewPanel}.vue`, `website/review/tests/{bridge,ui}.test.ts`: target creation, optional image, poster rendering, private proxy and race tests.
- `payload/env.cue`, `website/env.cue`: retained candidate deployment work, corrected preview migration dependency and generated `dist-review/server/wrangler.json` deployment config/toolchain.
- `.github/workflows/rawkode-academy-website-{default,pullrequest}.yml`: pre-existing candidate review-path trigger changes retained.

## Verification

The `node` executable for the successful checks was `/nix/store/7pn7zw2sciv3fih9l4xpyvx0q8hlrr0w-nodejs-24.20.0/bin/node`.

From the checkout root:

- `cuenv sync -A`: exit 2. Installed CLI 0.53.2/schema 0.55.1 mismatch; schema registry fetch returned 401 Unauthorized, with cascading configuration errors. CUE task evaluation/generated CI verification remains unavailable.
- `git diff --check`: exit 0.

From `projects/rawkode.academy/payload`:

```sh
node --import tsx --test --test-timeout=60000 --test-concurrency=1 tests/staff-http.test.ts tests/intake.test.ts tests/review.test.ts tests/thumbnails.test.ts tests/migrations.test.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
WRANGLER_LOG_PATH=.runtime/wrangler.log POC_CLI=1 POC_BUILD=1 PAYLOAD_SECRET=local-verification-only-not-a-deployment-secret NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack
```

Results: **61/61 tests**, TypeScript exit 0, Next build exit 0 with both new routes in its output. Build uses only a disposable local secret and no remote bindings. Workerd warns that workflow/container bindings are unavailable in the local proxy; this does not establish hosted processing readiness.

From `projects/rawkode.academy/website`:

```sh
node node_modules/vitest/vitest.mjs run --config vitest.review.config.ts
node node_modules/astro/bin/astro.mjs build --config astro.review.config.mts
node node_modules/astro/bin/astro.mjs check --config astro.review.config.mts --tsconfig tsconfig.review.json
node node_modules/typescript/bin/tsc -p tsconfig.review.json --noEmit
node node_modules/@biomejs/biome/bin/biome lint review/bridge.ts review/types.ts review/tests/bridge.test.ts review/tests/ui.test.ts review/components/StaffUploadPanel.vue review/components/ReviewPanel.vue
node node_modules/@biomejs/biome/bin/biome lint ../payload/src/review/staff-http.ts ../payload/src/review/thumbnails.ts ../payload/src/review/service.ts ../payload/src/review/intake.ts ../payload/src/review/runtime.ts ../payload/src/review/contracts.ts ../payload/tests/staff-http.test.ts ../payload/tests/thumbnails.test.ts ../payload/tests/review.test.ts ../payload/tests/intake.test.ts
```

Results: **26/26 UI/bridge tests**, review build exit 0, generated deployment config present, Astro check 0 errors/warnings/hints (5 files). Plain website `tsc` exits 2 on the three existing `.vue` module imports in `ui.test.ts`; it is not a Vue-aware type checker. Biome exits 0 with 53 website and 71 backend warnings, no errors (principally non-null assertions/explicit any); no broad formatting cleanup applied.

Successful check logs are `/tmp/payload-fix-final-backend.log`, `/tmp/payload-fix-final-types.log`, `/tmp/payload-fix-final-ui.log`, `/tmp/payload-fix-final-review-build.log`, `/tmp/payload-fix-next-build.log`, `/tmp/payload-fix-astro-check.log`, and the lint logs under the same prefix.

## Environment and remaining limits

The original dependency symlinks pointed to an older iCloud-backed checkout with dataless files. Initial checks blocked in filesystem reads; Vitest's UI worker timed out before executing tests (bridge tests passed). Verification was recovered by copying already-installed parent dependencies into private `/tmp/payload-fix-deps` with APFS clones, then repointing only this checkout's four dependency symlinks. No dependency install or parent write was needed. Original link targets are recorded in `/tmp/payload-fix-original-dependency-links.json`; the working temporary links are left in place and depend on that temporary directory remaining available.

The new migration was exercised in in-memory SQLite tests, not applied to any hosted database. It must run before using the thumbnail endpoint. Hosted OIDC, actual R2/Media upload, transcoding, customer playback and deployment remain unverified.

Image validation checks structure, dimensions, MIME and stored digest; it does not fully decode compressed pixels. Concurrent identical uploads may retain an extra private immutable Media row while one association wins. Selected targets that become ineligible can remain visible until the backend rejects them safely. No remaining blocking source findings were identified in the final independent review; the thumbnail suite (11 tests) and Payload TypeScript were also independently run by the reviewer.

## PR preparation

Rebased the implementation onto current `main` (`dd2f88d4c`) before opening the PR. The sole conflict was in `payload/env.cue`: retained the newer input-free production deployment root while adding its review backend dependency, and matched the newer project-relative input convention for the new tasks. No application implementation changed during the rebase. Temporary dependencies, logs and generated outputs are excluded from the commit.

After rebase, reran the same focused backend command (61/61), UI/bridge command (26/26), and Payload TypeScript (exit 0); `git diff --check` also passed. The required sync was attempted again and failed on the same schema registry authentication/version mismatch. PR-preparation logs are `/tmp/payload-fix-pr-{backend,ui,types,sync}.log`. The earlier build and lint results above precede the rebase.

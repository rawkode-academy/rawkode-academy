# Customer video review preview

Implemented as a separate Astro/Vue entry in the existing website package. The public website build, routes, session implementation, DNS and GraphQL schema are unchanged. The media-capable backend and review UI are deployed to a named Cloudflare Worker Preview; production DNS and the public watch-page path remain unchanged.

## Files and behavior

- `website/review/components/ReviewApp.vue`: Academy sign-in, private grant-filtered paginated list, deep links, account/session refresh, sign-out and empty states. Auth/view epochs discard stale responses after sign-out, navigation, account changes and successful mutations.
- `website/review/components/ReviewPanel.vue`: native authenticated video with seeking, timestamp comments rendered as plain text, own-comment/staff resolution, change requests, exact revision/version approval confirmation, and separate staff publication confirmation. Ambiguous network results retry the original command UUID. Conflicts refetch and require a new action.
- `website/review/bridge.ts`: exact path/method allowlist, configured origin validation, original Origin preservation, OIDC-only cookies, removal of identity/forwarded/auth headers, streamed byte ranges, separate Set-Cookie preservation, validated deep-link return cookie. No admin API or credentials reach the client. Private responses are no-store.
- `payload/src/review/{service,http,runtime}.ts`: active-grant-only listing with stable cursor pagination, minimal summary DTOs, own approval capability and explicit runtime publication availability. Staff can list managed revisions. Backend commands remain authoritative.
- `website/astro.review.config.mts`, `website/wrangler.review.jsonc`: additive preview UI. preview.rawkode.academy binds `REVIEW_BACKEND` to the production `rawkode-academy-payload` Worker; there is no separate review backend Worker. The API binding retains the browser URL. Host-aware OIDC for the preview hostname (callback `https://preview.rawkode.academy/api/auth/callback`) is tracked separately and is not yet live.

The review backend is the production Payload Worker, so review data lives in the production D1/R2 resources and uses the production staff allowlist. That Worker also serves admin.rawkode.academy; on preview.rawkode.academy the website bridge exposes only the selected review/auth APIs. Staff still provision grants and cuts through authorized backend tooling; this surface does not add upload or grant-management screens.

## Verification

- Required `cuenv sync -A` attempted first: exit 2, host CLI 0.53.2 versus schema 0.55.1, missing .rules.cue in this pruned checkout and CUE registry 401. No credentials were changed. Existing dependency trees were linked read-only; generated caches and design-system CSS stayed in the isolated checkout.
- Payload: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
- Payload regression suite: `node --import tsx --test --test-concurrency=1 tests/compatibility.test.ts tests/oidc.test.ts tests/content-import.test.ts tests/media-security.test.ts tests/migrations.test.ts tests/review.test.ts` passed 86 tests. New coverage checks cross-customer metadata isolation, revoked grants, capability updates, safe fields, cursors and pagination.
- Website: `node node_modules/vitest/vitest.mjs run --config vitest.review.config.ts` passed 18 tests. Includes bridge cookie/origin/path/range behavior, plain-text rendering, exact approval, 409 refresh, idempotent retry, blocked remote publication, stale session/list responses after logout, principal changes, navigation and no-revision state.
- Website Vue TypeScript: `node ../../../packages/design-system/node_modules/vue-tsc/bin/vue-tsc.js --noEmit --project tsconfig.review.json` passed.
- Design-system `node node_modules/@pandacss/dev/bin.js build` and website `node node_modules/astro/bin/astro.mjs build --config astro.review.config.mts` passed. The preview config uses the website runtime's compatibility date and disables the inspector listener.
- Real headless Chromium against local Astro UI: `REVIEW_CHROMIUM_PATH=<installed Chromium executable> node --import tsx scripts/test-review-browser.ts` from Payload passed 11 workflow checks with **explicit mocked identity/API responses**: deep-link sign-in return, native MP4 metadata and seek, two Range requests, plain-text timestamp comment, resolution, change request, stale 409/refetch, exact-revision approval, staff handoff, revoked view removal, and sign-out. Screenshots are local ignored `.runtime/review-customer.png` and `.runtime/review-mobile.png`. This is not a live OIDC, D1, R2 or Worker-to-Worker test.

## Run and deployment boundary

The website package has `review:build`, `review:dev`, and `review:test` commands. Build produces `dist-review/server/wrangler.json`. The isolated preview configuration targets preview.rawkode.academy; no deployment command was run. Building does not verify live domain ownership, callback registration, secrets, migrations or binding connectivity.

`review:dev` starts the UI on 127.0.0.1:3100. Its checked-in binding/origin configuration targets the remote preview and does not establish a local paired backend by itself. For a real paired local test, configure the UI's REVIEW_ORIGIN and the backend OIDC_REDIRECT_URI consistently to `http://127.0.0.1:3100` and its `/api/auth/callback`, run both named Workers with the private binding, and apply migrations to local data. Keep POC_DEV_LOCAL_AUTH false. This paired runtime remains unverified. The browser fixture script instead uses the local UI on port 4319 and intercepts its APIs explicitly; it cannot submit real approvals.

**Normal customer footage is not yet production-approved by the current media gate.** The hosted Preview now accepts and processes the checked-in synthetic MP4 through the native Container/Workflow/Workers AI path. Arbitrary footage still requires acceptance against the pinned probe/encode policy, capacity and quota controls, and production deployment. Do not generalize the synthetic Preview result to production media.

**Publication does not cut over the public Academy watch page.** It creates the existing backend publication artifact/snapshot; the public watch route still uses content.rawkode.academy HLS. That integration remains a separate gate. Runtime request revocation cannot retract video bytes already downloaded into a browser buffer.

Framework references checked: [Astro Cloudflare adapter](https://docs.astro.build/en/guides/integrations-guide/cloudflare/) and [Cloudflare HTTP service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/).

# Production deployment handoff: admin.rawkode.academy

The PR deployment path has now provisioned isolated preview resources and deployed a named Cloudflare Worker Preview. No production route, DNS change, customer data, or production staff allowlist has been changed. The production admin handoff below remains intentionally pending.

## Hosts: one Worker, two origins

`rawkode-academy-payload` is the only production Payload Worker. It serves `https://admin.rawkode.academy` directly and backs `https://preview.rawkode.academy` through the website review Worker, which binds `rawkode-academy-payload#ReviewBridge`. There is no separate review backend Worker.

- **Ingress decides the host.** `worker.ts` delegates to `src/ingress.ts`. Both entrypoints always delete any inbound `x-academy-public-origin` header and stamp it from the raw request URL only after their own allowlist check, so a browser cannot choose its host. Next code reads the host only through `requestOrigin()` in `src/auth/origin.ts`.
- **Admin is direct (soft gate).** The default `fetch` stamps the origin only when the request URL origin is in `OIDC_DIRECT_ORIGINS`. Any other host (CI branch previews `pr-<branch>-…workers.dev`, the `https://pipeline.internal` Workflow self-call) runs unstamped. It still serves the admin shell, public GraphQL/REST reads and the bearer-authenticated pipeline callback, but every OIDC surface fails closed: `/api/auth/login` returns 421, `/api/auth/session` returns 401, cookie-bearing mutations return 403 and review routes return 403.
- **Preview is reachable only through `ReviewBridge` (hard gate).** The named entrypoint has no public route. It answers 421 unless the URL origin is in `OIDC_BRIDGE_ORIGINS`, 404 for any path outside the review route table shared with `website/review/bridge.ts`, and 405 for a method outside that table. Preview can never reach `/admin`, REST or GraphQL.
- **The review API on admin is staff only.** When a bridge origin is configured, non-staff and anonymous requests to `/api/review/*` on a direct origin get 404, so customers review only on preview. A config with no bridge (the pr-local Worker Preview, loopback) keeps the customer flow on its direct origin, which `scripts/run-hosted-review-e2e.ts` relies on. `/api/review/published-media` stays public because it never resolves a session.
- **Redirect URI per host.** Login sends and stores `<request origin>/api/auth/callback` in the transaction row. The callback must match both the request host and the stored redirect URI, so a login started on admin cannot be completed on preview (400, no token exchange, transaction consumed).
- **Cookies are host-only per host.** `__Host-poc-oidc-session` and `__Host-poc-oidc-transaction` keep `Path=/`, `Secure` and no `Domain`. Admin and preview hold separate sessions in the shared table; signing out on one host does not sign out the other.
- **CSRF.** Every cookie-bearing mutation must carry an `Origin` equal to its own validated origin. Payload's `csrf` list is every configured origin.
- **Canonical published media.** `publicMediaUrl` uses the fixed `REVIEW_PUBLIC_MEDIA_ORIGIN` (prod: admin), never the host that ran the publish command. Content-bucket delivery replaces this later.
- **Only pr-local is sign-in capable among Worker Previews.** `https://pr-local-rawkode-academy-payload.rawkodeacademy.workers.dev` is registered with identity; other branch previews run unauthenticated.

One `OIDC_STAFF_SUBJECTS` list governs staff on both hosts.

## Current support matrix

| Requirement | Current code | Deployment prerequisite |
| --- | --- | --- |
| `OIDC_DIRECT_ORIGINS=["https://admin.rawkode.academy"]` | Admin is the direct, sign-in capable origin | Custom domain route on `rawkode-academy-payload`. |
| `OIDC_BRIDGE_ORIGINS=["https://preview.rawkode.academy"]` | Preview is accepted only through `ReviewBridge` | Payload must export `ReviewBridge` before the website review Worker binds it. |
| `REVIEW_PUBLIC_MEDIA_ORIGIN=https://admin.rawkode.academy` | Must be a direct origin; startup rejects anything else | None. |
| Origin lists | Exact entries from the registered callback origins only; no duplicates, no overlap, no loopback mixed with hosted origins, bridge origins must be `https` | Identity already registers admin, preview, pr-local and loopback for `rawkode-academy-preview`. |
| Real D1 binding `D1` | Runtime adapter consumes a genuine D1 binding | Apply every migration through `deploy.migrate` before the website rebinds `REVIEW_BACKEND`. |
| Real R2 binding `R2` | Runtime storage/workflow uses R2 API | Keep public bucket access disabled and verify authenticated object delivery. |
| Workflow binding `MEDIA_WORKFLOW` | Exports `MediaWorkflow` from `worker.ts` | Bind Workflow class `MediaWorkflow` to this Worker and verify remote execution/retries. |
| Self service `WORKER_SELF_REFERENCE` | Workflow calls `https://pipeline.internal/api/poc/pipeline/callback` through this binding; it runs unstamped with bearer auth | Point it at the deployed Worker's default entrypoint. |
| `ASSETS` | OpenNext static asset binding | Build first; bind `.open-next/assets` as generated. |
| `PAYLOAD_SECRET` | Required; runtime reads its environment binding | Fresh independent production secret in Workers secrets. Never copy local `.dev.vars`. |
| `PIPELINE_CALLBACK_SECRET` | Required by Workflow callback; separate from Payload | Distinct production secret bound to this same Worker/Workflow environment. |
| `OIDC_STAFF_SUBJECTS` | Exact subject allowlist; everyone else is a customer | Production lists one approved subject in `wrangler.jsonc`. Never substitute a user ID, email or Person ID for a verified `sub`. |
| `POC_DEV_LOCAL_AUTH=false` | Default; native login/reset/bootstrap/refresh denied | Preserve false. Startup rejects true unless every origin is loopback. |

## Public configuration

Production top-level `vars` in `wrangler.jsonc`:

```text
OIDC_ISSUER=https://id.rawkode.academy
OIDC_CLIENT_ID=rawkode-academy-preview
OIDC_DIRECT_ORIGINS=["https://admin.rawkode.academy"]
OIDC_BRIDGE_ORIGINS=["https://preview.rawkode.academy"]
REVIEW_PUBLIC_MEDIA_ORIGIN=https://admin.rawkode.academy
OIDC_SESSION_TTL_SECONDS=3600
POC_DEV_LOCAL_AUTH=false
```

`previews.vars` and `wrangler.preview-runtime.jsonc` use the pr-local origin as the only direct origin and media origin, with no bridge origin. `tests/wrangler-config.test.ts` checks that all three validate and that the two non-production sets agree.

**Local overrides never use `.dev.vars`**, because `deploy-preview.mjs` and `deploy:preview-runtime` ship it to remote Workers as `--secrets-file`. `bun run preview` (`scripts/preview-local.mjs`) passes loopback origins with `wrangler dev --var` and pins `--local-upstream 127.0.0.1:3100`, so the route to admin does not rewrite local request URLs. `bun run dev` and `bun run seed:oidc:tests` read the same overrides from the gitignored `.runtime/local.vars`, which `bun run setup` rewrites. The local staff fallback stays off by default; opt in with `bun run preview -- --var POC_DEV_LOCAL_AUTH:true`.

Public client authentication is `none`; scopes are fixed `openid profile email`; PKCE is S256; accepted ID-token algorithm is RS256. **No OIDC client secret is required.** The exact callback and trusted origin must exist in identity-service configuration. Its GitHub/provider/signing secrets do not belong in the POC. The account's user ID, email or editorial Person ID must not be substituted for a verified OIDC `sub` in the staff allowlist.

## Resource/build/migration prerequisites

1. Use an isolated paid Workers environment and the pinned Node/npm/Payload/Next/OpenNext/Wrangler dependencies. Confirm the final bundle meets the account's limits. Keep the existing public Academy gateway and services untouched.
2. Create a deployment-specific configuration with the real account/resource identifiers, selected custom domain/routing, D1, R2, Workflow, self service, ASSETS, public auth variables and secrets. The checked-in config deliberately has a fake local D1 UUID, local resource names, no account/routes and `workers_dev:false`; it is not a production config.
3. Apply all five Payload migrations through `20261004_161607_oidc`. The final migration adds protected user identity fields and explicitly owned `poc_oidc_transactions`/`poc_oidc_sessions` tables. Preserve those custom tables and optional MCP evaluation tables during future automatic schema diffs. On a fresh DB there are no local staff accounts to preserve.
4. **Existing `npm run migrate` is local-only**: `POC_CLI=1` uses Wrangler's platform proxy with `remoteBindings:false`. It must not be presented as a remote migration command. Prepare and verify an explicit production migration path or reviewed SQL execution plan against the real D1 DB, including Payload's migration bookkeeping. This work did not test such a remote runner or produce a validated remote migration SQL export.
5. Build with `npm run build:worker`; deploy `worker.ts` so the Workflow class and root GraphQL compatibility routing are retained. Do not deploy only the generated OpenNext entrypoint. The production runtime uses `getCloudflareContext`; CLI/build bindings remain isolated. Put the two fresh secrets into the deployment environment before the first authenticated/Workflow request.
6. Verify remote D1 persistence/upsert, private R2 access, Workflow self-callback and startup before directing users there. Test a genuine Academy browser authorization/callback using the agreed hostname, then customer denial, staff allowlist changes and logout/expiry. Local seeded-session evidence is not a live-provider or remote-runtime pass.

The preview resources and deployment secrets are isolated to the named PR Preview; no production route or real staff subject is configured. MCP remains excluded from the default build. AI transcription/encoding, customer project grants, full public GraphQL identity/domain parity, concurrent editorial writes and production-load behavior remain separate no-go limitations; deploying the isolated experiment does not imply those features are ready.

`deploy.main` runs the build and the production D1 migration, then `wrangler deploy --tag <first 12 characters of the commit SHA>`. `deploy.reviewRuntime` depends on `deploy.main`, so it runs only after production has deployed: it migrates the -preview D1/R2 and deploys the persistent non-production runtime, which PR previews reach through their `script_name` binding. No separate review backend Worker exists; preview.rawkode.academy forwards to the production Worker's `ReviewBridge` entrypoint, and the website's review deploy waits until Payload serves the pushed commit (or a newer commit containing it) whenever the push matches the push paths of `rawkode-academy-payload-default.yml`. If that wait fails, run the website default workflow manually with `skip_payload_wait` once Payload is confirmed live. The Payload workflows end with a step that fails unless `cuenv ci` wrote this project's pipeline report, because cuenv skips a project whose `env.cue` fails to evaluate and still exits 0. The production `wrangler.jsonc` declares the `ReviewFFmpegContainer` container and Durable Object, so `deploy.main` itself needs the Containers edit permission on the shared Workers token.

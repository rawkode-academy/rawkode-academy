# Production deployment handoff: admin.rawkode.academy

The PR deployment path has now provisioned isolated preview resources and deployed a named Cloudflare Worker Preview. No production route, DNS change, customer data, or production staff allowlist has been changed. The production admin handoff below remains intentionally pending.

## Blocking host mismatch

**The current code does not support `https://admin.rawkode.academy` as the application hostname while keeping `OIDC_REDIRECT_URI=https://preview.rawkode.academy/api/auth/callback`.**

`src/auth/config.ts` derives the application/CSRF origin directly from the callback URI. `src/auth/oidc.ts` requires requests at that origin and uses host-only `__Host-` cookies. A login started on `admin.rawkode.academy` is rejected by the origin check; a callback on `preview.rawkode.academy` also cannot receive a transaction cookie scoped to the admin host or set a session cookie for it. Both hosts pointing to the same Worker does not change browser cookie isolation. The allowlist currently accepts only the requested preview callback and local callback, and rejects an admin callback.

The smallest coherent deployment change is to register `https://admin.rawkode.academy/api/auth/callback` for the same client, add it to the POC's strict callback allowlist, and configure that callback for the admin deployment. Add the admin origin to identity-service trusted origins, then retest host-specific cookies, authorization/callback, CSRF, staff access and logout. This handoff does not change the requested callback or the identity-service registration without coordination.

If the preview callback must remain the sole production callback, implement a separately reviewed one-time handoff between preview and admin, with independent browser-bound transactions and host-only sessions. Merely accepting another Host or sharing a broad Domain cookie is not equivalent to the current security boundary. That cross-host protocol is not implemented.

## Current support matrix

| Requirement | Current code | Deployment prerequisite |
| --- | --- | --- |
| `OIDC_REDIRECT_URI=https://preview.rawkode.academy/api/auth/callback` | Accepted; intended app origin becomes `https://preview.rawkode.academy` | Deploy/routable callback at that origin and verify actual provider registration/sign-in. Incompatible with admin-only hosting as explained above. |
| App hostname `https://admin.rawkode.academy` | Not accepted as auth application origin; not a callback option | Resolve the callback/host contract before deployment. |
| Real D1 binding `D1` | Runtime adapter consumes a genuine D1 binding; tests used local workerd | Provision isolated real DB, set actual database UUID/name, apply all schema migrations, verify persistence. D1 upsert wrapper remains required for pinned3.90.2. |
| Real R2 binding `R2` | Runtime storage/workflow uses R2 API; tests used local bucket | Provision isolated private bucket, bind `R2`, keep public bucket access disabled and verify authenticated object delivery. |
| Workflow binding `MEDIA_WORKFLOW` | Exports `MediaWorkflow` from `worker.ts`; native local tests pass | Bind Workflow class `MediaWorkflow` to this Worker and verify remote execution/retries. Processing still uses deterministic fixtures. |
| Self service `WORKER_SELF_REFERENCE` | Workflow calls the internal callback through this binding | Point it at the actual deployed Worker service name; preserve binding in production environment config. |
| `ASSETS` | OpenNext static asset binding | Build first; bind `.open-next/assets` as generated. |
| `PAYLOAD_SECRET` | Required; runtime reads its environment binding | Generate a fresh independent production secret in Workers secrets. Never copy local `.dev.vars` or identity-service credentials. Keep stable through normal redeploys. |
| `PIPELINE_CALLBACK_SECRET` | Required by Workflow callback; separate from Payload | Generate a distinct production secret bound to this same Worker/Workflow environment. No user authentication with this secret. |
| `OIDC_STAFF_SUBJECTS=[]` | Supported and verified; all OIDC subjects remain customers | Safe deny-by-default. Nobody can use editorial admin until an explicitly approved real subject is supplied. No subject was invented. |
| `POC_DEV_LOCAL_AUTH=false` | Default; native login/reset/bootstrap/refresh denied | Preserve false. Startup rejects true with the current production callback. Do not use local bootstrap for cloud access. |

## Public configuration after the hostname decision

The currently implemented preview-host configuration is:

```text
OIDC_ISSUER=https://id.rawkode.academy
OIDC_CLIENT_ID=rawkode-academy-preview
OIDC_REDIRECT_URI=https://preview.rawkode.academy/api/auth/callback
OIDC_STAFF_SUBJECTS=[]
OIDC_SESSION_TTL_SECONDS=3600
POC_DEV_LOCAL_AUTH=false
```

Public client authentication is `none`; scopes are fixed `openid profile email`; PKCE is S256; accepted ID-token algorithm is RS256. **No OIDC client secret is required.** The exact callback and trusted origin must exist in identity-service configuration. Its GitHub/provider/signing secrets do not belong in the POC. The account's user ID, email or editorial Person ID must not be substituted for a verified OIDC `sub` in the staff allowlist.

## Resource/build/migration prerequisites

1. Use an isolated paid Workers environment and the pinned Node/npm/Payload/Next/OpenNext/Wrangler dependencies. Confirm the final bundle meets the account's limits. Keep the existing public Academy gateway and services untouched.
2. Create a deployment-specific configuration with the real account/resource identifiers, selected custom domain/routing, D1, R2, Workflow, self service, ASSETS, public auth variables and secrets. The checked-in config deliberately has a fake local D1 UUID, local resource names, no account/routes and `workers_dev:false`; it is not a production config.
3. Apply all five Payload migrations through `20261004_161607_oidc`. The final migration adds protected user identity fields and explicitly owned `poc_oidc_transactions`/`poc_oidc_sessions` tables. Preserve those custom tables and optional MCP evaluation tables during future automatic schema diffs. On a fresh DB there are no local staff accounts to preserve.
4. **Existing `npm run migrate` is local-only**: `POC_CLI=1` uses Wrangler's platform proxy with `remoteBindings:false`. It must not be presented as a remote migration command. Prepare and verify an explicit production migration path or reviewed SQL execution plan against the real D1 DB, including Payload's migration bookkeeping. This work did not test such a remote runner or produce a validated remote migration SQL export.
5. Build with `npm run build:worker`; deploy `worker.ts` so the Workflow class and root GraphQL compatibility routing are retained. Do not deploy only the generated OpenNext entrypoint. The production runtime uses `getCloudflareContext`; CLI/build bindings remain isolated. Put the two fresh secrets into the deployment environment before the first authenticated/Workflow request.
6. Verify remote D1 persistence/upsert, private R2 access, Workflow self-callback and startup before directing users there. Test a genuine Academy browser authorization/callback using the agreed hostname, then customer denial, staff allowlist changes and logout/expiry. Local seeded-session evidence is not a live-provider or remote-runtime pass.

The preview resources and deployment secrets are isolated to the named PR Preview; no production route or real staff subject is configured. MCP remains excluded from the default build. AI transcription/encoding, customer project grants, full public GraphQL identity/domain parity, concurrent editorial writes and production-load behavior remain separate no-go limitations; deploying the isolated experiment does not imply those features are ready.

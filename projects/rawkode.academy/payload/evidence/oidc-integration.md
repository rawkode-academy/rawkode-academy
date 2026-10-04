# Academy OIDC integration

Implemented in the isolated POC on 2026-10-04. The public identity client and admin callback were registered on the identity service, and the isolated Worker Preview has been deployed. No production data, DNS route or real staff allowlist was changed. Public discovery was read; no live authorization code exchange or live userinfo fetch has been completed.

## Exact client contract

Register a **public** authorization-code client in the identity service:

- Client ID: `rawkode-academy-preview`
- Issuer: `https://id.rawkode.academy`
- Token endpoint authentication method: `none` (no client secret; no Basic header)
- Response type/mode: `code` / `query`
- Requested scopes: `openid profile email`
- PKCE: S256; the POC always sends a challenge and verifier. Provider-side `requirePKCE:true` should reject authorization without a challenge.
- Exact redirect URIs: `https://preview.rawkode.academy/api/auth/callback`, `https://admin.rawkode.academy/api/auth/callback`, and `http://127.0.0.1:3100/api/auth/callback`.
- Trusted application origins: `https://preview.rawkode.academy`, `https://admin.rawkode.academy`, and `http://127.0.0.1:3100`.
- ID-token signature policy: RS256, matching the inspected provider config and current public JWKS. Algorithm changes fail closed until explicitly reviewed.

There is **no `OIDC_CLIENT_SECRET` requirement** and provider secrets must not be copied. The provider's compatibility placeholder is not a credential for this client. The parent task owns registration/deployment; source-present registration is not verified deployment. See [identity-service contract](identity-service-contract.md) for the inspected provider configuration and source/live distinctions.

## POC environment variables

| Variable | Local value / rule | Production value / rule |
| --- | --- | --- |
| `OIDC_ISSUER` | `https://id.rawkode.academy` | Same exact issuer |
| `OIDC_CLIENT_ID` | `rawkode-academy-preview` | Same exact client ID |
| `OIDC_REDIRECT_URI` | `http://127.0.0.1:3100/api/auth/callback` | `https://admin.rawkode.academy/api/auth/callback` for this admin deployment; `https://preview.rawkode.academy/api/auth/callback` for the customer preview app |
| `OIDC_STAFF_SUBJECTS` | JSON array; default `[]` | Explicit JSON array of approved Academy subject IDs; default deny |
| `OIDC_SESSION_TTL_SECONDS` | `3600`; allowed 60–3600 | Same bound; further capped by ID/access-token expiry |
| `POC_DEV_LOCAL_AUTH` | `false` by default; literal `true` is an explicit development opt-in | Must be `false`; startup rejects `true` with the production callback |

Scope and token-auth method are fixed in code, not guessed from environment variables. Existing `D1`, `PAYLOAD_SECRET` and `PIPELINE_CALLBACK_SECRET` remain local application bindings/secrets. No additional signing secret is needed for opaque OIDC sessions: D1 stores only the random session token's SHA-256 hash.

The development flag is a configuration restriction, not a deployment-prevention system. This POC must still not be deployed without a separate reviewed deployment configuration. Pre-OIDC local accounts retain staff roles through the migration but cannot authenticate when local fallback is off. They are never merged with OIDC identities, including equal email addresses.

## Protocol and session behavior

`GET /api/auth/login` discovers the pinned issuer and creates independent random state, nonce, PKCE verifier and browser binding. Only trusted same-issuer HTTPS endpoints are used. A ten-minute D1 transaction stores the verifier/nonce; the browser receives an opaque host-only HttpOnly SameSite=Lax transaction cookie. Production cookies are Secure and use the `__Host-` prefix.

`GET /api/auth/callback` requires the configured origin/path, one state/code/error parameter each, matching browser binding, and an unexpired transaction. One `DELETE ... WHERE state_hash=? AND binding_hash=? AND expires_at>? RETURNING ...` statement consumes the transaction before exchange. Replay and concurrent callback consumption cannot reuse it. A failed exchange requires starting again.

The pinned `oauth4webapi` library validates the authorization response and ID-token claims, followed by explicit JWKS signature validation. Issuer, audience/authorized party, expiry, issued-at and nonce are checked. Userinfo must match the verified ID-token subject. The POC uses public-client token authentication and sends the exact registered callback and original verifier. Provider tokens stay in memory for that request, are not persisted, and are never returned to the browser. No refresh-token flow or silent session extension is implemented.

A unique hash of `[issuer, subject]` identifies the Payload user. Profile email is stored only when verified and never determines identity or staff privilege. Synthetic internal email addresses satisfy Payload's native schema without linking accounts by email. Unique insertion conflicts recover by the same identity key. Protected identity/role fields cannot be changed through editorial APIs.

Sessions use a new random opaque token; D1 stores its hash, user ID and fixed expiry. Authentication rechecks expiry and user existence on every request. Staff access is recalculated from the configured subject allowlist on every request, so removing an allowlist entry takes effect without waiting for session expiry. `/api/auth/session` exposes only ID/name/role and expiry. No project/customer grants exist yet: customers can read only their own user record and public catalogue data, and cannot access private media/drafts, admin, imports, pipeline commands or editorial mutations.

Both `POST /api/auth/logout` and Payload's native admin logout revoke the current OIDC session. Dedicated logout clears its cookie; the native logout hook revokes it server-side even if an expired cookie remains in the browser. Native Payload token refresh is restricted to explicitly enabled local staff JWT sessions; it cannot renew or convert an OIDC session. Preview logout does not log out of Academy globally. Provider back-channel logout and immediate provider-account revocation are not implemented; the bounded session lifetime limits that gap.

Cookie-authenticated mutations require the exact trusted Origin in both the Worker and Next route wrappers. The custom strategy also rejects foreign Origin headers. Node development and Worker execution share the guard; neither relies on Payload's native JWT CSRF handling. Next's observed internal `http://localhost:3100` URL is normalized only when the configured callback is local **and** the actual Host header is exactly `127.0.0.1:3100`. No forwarded-host header is trusted; all other origins remain rejected. Redirects after sign-in are fixed to `/account`, with no user-controlled return URL.

## Reproduce tests

```sh
npm run setup
npm run migrate
npm run test:oidc
npm run seed:oidc:tests
npm run build:worker
npm run preview
```

In another terminal, `npm run test:oidc:worker`. Stop preview before reseeding. Fixture session material is written only to ignored `.runtime/oidc-fixtures.json` with restrictive permissions. The seed command uses trusted local Payload APIs and local D1; no test-auth HTTP endpoint exists. Tests revoke their valid sessions when complete; reseed before repeating.

For the original catalogue/admin/pipeline regression, restart preview with `npm run preview -- --var POC_DEV_LOCAL_AUTH:true`, then run `bootstrap`, `test:worker`, `test:admin` and `test:pipeline`. Return to the default unflagged preview afterward.

Evidence is split deliberately:

- `oidc-protocol-tests.txt`: real OAuth library/WebCrypto validation with ephemeral RS256 keys and an injected synthetic provider; no live token/userinfo call.
- `oidc-d1.json`: actual local D1 mapping and atomic concurrent transaction consumption.
- `oidc-worker.json`: actual workerd session/access/expiry/logout/CSRF checks using trusted seeded sessions, plus public discovery/authorization-URL generation without following the redirect.
- `oidc-next-csrf.json`: hostile/missing Origin rejection at the Node development entry point.
- `oidc-verification.json`: final command results, review and remaining gates.

A successful live Academy sign-in, real staff-subject configuration, and production deployment remain unverified. The deployed preview callback is intentionally pointed at `admin.rawkode.academy`, so a browser flow on the workers.dev preview host is not an end-to-end session test. Existing public GraphQL `me` still returns null: preview session identity is not silently substituted for the Academy gateway's separate Person/identity contract. Customer project sharing and tenant-owned content require a separate domain model; current behavior fails closed.

References: [Payload custom strategies](https://payloadcms.com/docs/authentication/custom-strategies), [oauth4webapi protocol API](https://github.com/panva/oauth4webapi/blob/main/docs/README.md), [public provider discovery](https://id.rawkode.academy/.well-known/openid-configuration).

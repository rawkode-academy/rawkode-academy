# Academy identity contract for the preview client

Read-only inspection on 2026-10-04. No identity records, credentials or environment values were fetched. No identity-service files or production resources were changed by this review.

## Verified live discovery

The public [OIDC discovery document](https://id.rawkode.academy/.well-known/openid-configuration) was fetched successfully with curl. These are advertised endpoints; no authenticated token exchange or userinfo call was performed.

| Setting | Verified value |
| --- | --- |
| Issuer | `https://id.rawkode.academy` |
| Authorization | `https://id.rawkode.academy/auth/oauth2/authorize` |
| Token | `https://id.rawkode.academy/auth/oauth2/token` |
| Userinfo | `https://id.rawkode.academy/auth/oauth2/userinfo` |
| JWKS | `https://id.rawkode.academy/auth/jwks` |
| Registration | `https://id.rawkode.academy/auth/oauth2/register` |
| End session | `https://id.rawkode.academy/auth/oauth2/endsession` |
| Response type / mode | `code` / `query` |
| Grants | `authorization_code`, `refresh_token` |
| Token endpoint authentication methods | `none`, `client_secret_basic`, `client_secret_post` |
| PKCE methods | `S256` |
| Advertised ID-token algorithms | `RS256`, `EdDSA` |

The public [JWKS endpoint](https://id.rawkode.academy/auth/jwks) currently returned one RSA key with `alg: RS256`. Local runtime source configures the JWT plugin for RS256 with a 2048-bit RSA key. The broader advertised algorithm list is not evidence of an active EdDSA signing key. Configure an explicit accepted algorithm policy; do not trust the token's `alg` value without validation.

## Client registration: source present, deployment unverified

Inspected checkout: `/Users/rawkode/Code/src/github.com/rawkode-academy/rawkode-academy`, HEAD `7dee11ffe5a2306a4943593c2f669d3ef82b001d`. At inspection, `projects/rawkode.academy/identity/src/lib/auth.ts` was modified; migration `0016_add_rawkode_academy_preview_oauth.sql` was untracked and the migration journal was modified. Those local changes contain the preview client. This is not proof that the deployed provider recognizes it.

The runtime `oidcProvider({ trustedClients: [...] })` registration shape in that working tree is:

```ts
{
  clientId: 'rawkode-academy-preview',
  name: 'Rawkode Academy Preview',
  type: 'public',
  // Existing provider compatibility placeholder field omitted here.
  // It is not a consumer credential and must not be sent by the POC.
  redirectUrls: [
    'https://preview.rawkode.academy/api/auth/callback',
    'http://127.0.0.1:3100/api/auth/callback',
  ],
  disabled: false,
  skipConsent: true,
  metadata: null,
}
```

The source also adds `https://preview.rawkode.academy` and `http://127.0.0.1:3100` to `trustedOrigins`. Redirect URLs are exact matches: `localhost`, another port, a trailing slash or another callback path is not interchangeable. Provider registration exists in both the trusted-client configuration and the proposed D1 migration; the deployment owner must reconcile and verify both without assuming one proves the other.

Use `token_endpoint_auth_method: none` for this public client. Request only `openid profile email` initially. Discovery also advertises `offline_access`, `roles` and `groups`; request additional scopes only for an implemented need. A successful login does not establish staff or project access. The existing access-claims helper derives roles from assignments scoped to client ID, and may return no roles. Keep default-deny authorization independent of authentication.

## PKCE, nonce and validation

Installed local Better Auth is **1.6.14**, while the repository lockfile resolves **1.6.13** and the identity package declares `^1.4.3`. The deployed exact version was not established. The following implementation observations apply to the installed source, not an authenticated production test:

- `node_modules/better-auth/dist/plugins/oidc-provider/authorize.mjs` matches redirect URLs exactly and stores the supplied challenge, challenge method and nonce with the authorization code.
- `index.mjs` requires a verifier for public clients, validates S256 when a challenge was stored, binds the code to client ID and redirect URI, and includes the stored nonce in the signed ID token.
- The current identity runtime does not explicitly set `requirePKCE: true`. In the inspected implementation, authorization-time rejection of a missing challenge depends on that setting. Requiring a verifier without a stored challenge does not prove PKCE binding. **Recommendation to the identity deployment owner: enable `requirePKCE: true` and test missing challenge, wrong verifier, redirect mismatch and replay rejection.** This review did not change it.

The preview consumer must always create independent cryptographically random PKCE verifier, state and nonce values; bind them to one short-lived browser transaction, consume them once, and reject missing/mismatched values. Send `code_challenge_method=S256` on authorization. Token exchange uses form encoding with `grant_type`, `client_id`, `code`, exact `redirect_uri` and `code_verifier`, without a client secret or Basic header. Validate ID-token signature against the trusted JWKS, issuer, audience, expiration and nonce; if userinfo is fetched, require its `sub` to match the validated ID token. Access tokens are opaque in the inspected provider implementation.

The existing Academy website helper implements S256 but its state encodes only a return path; it does not send a nonce, and the inspected callback consumes userinfo rather than validating an ID token. It is an integration reference, not a safe template to copy unchanged. Bind sessions to issuer plus stable `sub`, not email, GitHub handle or editorial Person ID. Restrict return paths to local relative destinations.

## Environment and secret requirements

**Identity service, existing source contract:** `DB` is a D1 binding; `AUTH_SECRET`, `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` are `SecretsStoreSecret` bindings resolved by server code. `SITE_URL` is optional and defaults to the issuer above; `ANALYTICS` is an optional service binding. Those provider secrets already belong to the identity service and must not be copied into the preview application. There is no preview-specific client-secret environment requirement for the public-client registration.

**Preview consumer configuration to implement:** issuer `https://id.rawkode.academy`, client ID `rawkode-academy-preview`, scope `openid profile email`, authentication method `none`, and one exact callback URL selected by deployment environment. These are public configuration values, not secrets. If represented as environment variables, use explicit names such as `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_SCOPE` and `OIDC_REDIRECT_URI`; these names are a proposed consumer contract, not pre-existing variables found in the identity service.

The preview app still needs its own secure session mechanism and transaction storage. This POC already uses locally generated `PAYLOAD_SECRET` and `PIPELINE_CALLBACK_SECRET`; neither is an identity-provider credential, and the callback secret must never authenticate an end-user. Do not reuse the provider signing secret, GitHub secret or server compatibility placeholder for preview sessions.

## Remaining gates

Verify deployed preview registration and both exact callbacks; perform a real browser login; verify nonce/state/PKCE and signed ID-token validation; test logout, expiry, replay and denied users. Prove identity-to-staff/project-grant mapping separately. The installed `oidcProvider` plugin reports deprecation in favour of `oauth-provider`; record that upgrade risk without changing provider implementations inside this POC.

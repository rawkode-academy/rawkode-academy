# Operator authentication

The public audience site continues to use anonymous signed sessions. Privileged
host, producer, and moderation routes require a verified Cloudflare Access JWT
(`Cf-Access-Jwt-Assertion`); identity headers alone are never accepted.

Set `CF_ACCESS_TEAM_DOMAIN` to the Access team hostname (without `https://`) and
`CF_ACCESS_AUD` to the Access application audience. The Worker retrieves the
team JWKS from `/cdn-cgi/access/certs`, verifies RS256 signatures, issuer,
audience, expiry, and not-before values, and caches keys for five minutes.

Provision operators in `arcade_operators` with `identity_subject` equal to
`cf-access:<Access sub>` (preferred) or the raw Access `sub`. For break-glass
operation only, `OPERATOR_EMAILS` accepts comma-separated
`email[:host|producer|moderator]` entries. The deployment task installs that
allow-list and both signing keys as Cloudflare secrets; they are never written
to generated deployment configuration.

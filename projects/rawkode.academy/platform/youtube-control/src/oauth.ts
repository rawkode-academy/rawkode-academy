import {
  AuthorizationError, OAuthError, OAuthProvider, authorizationErrorRedirect, insufficientScope,
  type ConsentDescription, type OAuthHelpers, type OAuthResourceContext,
} from "@cloudflare/workers-oauth-provider";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createMcpHandler } from "agents/mcp/server";
import { ensure, errorBody, readLimited, ServiceError } from "./domain.ts";
import { validateOrigin } from "./auth.ts";
import { createServer } from "./mcp.ts";

const SCOPES = ["youtube:read", "youtube:publish", "offline_access"];
// Only public signing keys are cached. No login state or credentials live here.
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), { timeoutDuration: 10000 });
type OwnerProps = { ownerSub: string };
type LoginState = { verifier: string; nonce: string };
type OAuthEnv = CloudflareEnv & { OAUTH_PROVIDER: OAuthHelpers };

export function publicOrigin(env: Pick<CloudflareEnv, "PUBLIC_ORIGIN">) {
  let url: URL;
  try { url = new URL(env.PUBLIC_ORIGIN); } catch { throw new ServiceError("not_configured", "MCP public origin is not configured", 503); }
  ensure(url.protocol === "https:" && url.origin === env.PUBLIC_ORIGIN, "not_configured", "PUBLIC_ORIGIN must be a canonical HTTPS origin without a trailing slash", 503);
  return url.origin;
}
function requireLoginConfig(env: CloudflareEnv) {
  ensure(/^[A-Za-z0-9_-]{1,255}$/.test(env.MCP_OWNER_GOOGLE_SUB ?? "") && env.MCP_GOOGLE_CLIENT_ID && env.MCP_GOOGLE_CLIENT_SECRET, "not_configured", "MCP owner sign-in is not configured", 503);
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
export function renderConsent(details: ConsentDescription, handle: string) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connect Rawkode Academy YouTube</title><style>body{font:18px/1.5 system-ui;max-width:40rem;margin:4rem auto;padding:0 1.5rem;background:#10121b;color:#f5f5fa}h1{line-height:1.2}label{display:block;margin:1.5rem 0}button{font:inherit;padding:.6rem 1rem;margin-right:.6rem}small{color:#b7bdd3}strong{overflow-wrap:anywhere}</style>
  <h1>Connect ${escape(details.clientName)} to YouTube</h1>
  <p>Access will return to <strong>${escape(details.redirectHost)}</strong>.</p>
  <p>${details.clientDomain ? `Client domain: <strong>${escape(details.clientDomain)}</strong>.` : "The client supplied its own name. Check the return address before continuing."}</p>
  ${details.redirectIsLoopback ? "<p><strong>This returns access to an app on your computer.</strong> Continue only if you started this connection.</p>" : ""}
  <form method="post" action="/oauth/authorize"><input type="hidden" name="handle" value="${escape(handle)}">
  <p>This connection can read Rawkode Academy’s YouTube analytics and broadcasts, and prepare changes for review.</p>
  <label><input type="checkbox" name="publish" value="yes"> Also allow publishing reviewed changes, including public broadcasts, titles, descriptions, times and thumbnails.</label>
  <p><small>The connection can refresh its access for up to 30 days. Signing in below only verifies the configured owner. YouTube account credentials are never shared with this client.</small></p>
  <button name="decision" value="approve">Continue with Google</button><button name="decision" value="deny">Cancel</button></form></html>`;
}
function pageHeaders(headers: Headers) {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  headers.set("x-frame-options", "DENY");
  return headers;
}
export async function s256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(bytes).toString("base64url");
}
async function signIn(request: Request, env: OAuthEnv) {
  requireLoginConfig(env);
  const oauth = env.OAUTH_PROVIDER;
  if (request.method === "GET") {
    const original = await oauth.parseAuthRequest(request);
    ensure(original.codeChallenge && original.codeChallengeMethod === "S256", "invalid_request", "S256 PKCE is required");
    ensure(original.scope.every(s => SCOPES.includes(s)), "invalid_scope", "Unsupported OAuth scope");
    const details = await oauth.describeConsent(original);
    const consent = await oauth.beginConsent(original);
    return new Response(renderConsent(details, consent.handle), { headers: pageHeaders(consent.headers) });
  }
  ensure(request.method === "POST", "method_not_allowed", "Use GET or POST", 405);
  validateOrigin(request);
  ensure(request.headers.get("content-type")?.split(";")[0] === "application/x-www-form-urlencoded", "content_type", "Expected an HTML form", 415);
  const form = new URLSearchParams(new TextDecoder().decode(await readLimited(request.body, 8192)));
  const handle = form.get("handle") ?? "";
  if (form.get("decision") !== "approve") {
    const denied = await oauth.denyConsent(request, handle);
    denied.headers.set("referrer-policy", "no-referrer");
    return new Response(null, { status: 302, headers: denied.headers });
  }
  const scope = ["youtube:read", "offline_access", ...(form.get("publish") === "yes" ? ["youtube:publish"] : [])];
  const approved = await oauth.approveConsent(request, handle, { scope });
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const nonce = crypto.randomUUID();
  const transaction = await oauth.beginUpstream(approved.request, { data: { verifier, nonce }, headers: approved.headers });
  const location = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  location.search = new URLSearchParams({ client_id: env.MCP_GOOGLE_CLIENT_ID, redirect_uri: `${publicOrigin(env)}/oauth/callback`, response_type: "code", scope: "openid", state: transaction.state, nonce, code_challenge: await s256(verifier), code_challenge_method: "S256", prompt: "select_account" }).toString();
  transaction.headers.set("location", location.toString());
  transaction.headers.set("referrer-policy", "no-referrer");
  return new Response(null, { status: 302, headers: transaction.headers });
}
async function callback(request: Request, env: OAuthEnv) {
  requireLoginConfig(env);
  ensure(request.method === "GET", "method_not_allowed", "Use GET", 405);
  const oauth = env.OAUTH_PROVIDER;
  const { request: original, data, headers } = await oauth.finishUpstream<LoginState>(request);
  headers.set("referrer-policy", "no-referrer");
  const parameters = new URL(request.url).searchParams;
  if (parameters.has("error")) {
    headers.set("location", authorizationErrorRedirect(original, "access_denied"));
    return new Response(null, { status: 302, headers });
  }
  const code = parameters.get("code");
  ensure(code && code.length <= 4096, "invalid_callback", "Missing Google authorization code");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: env.MCP_GOOGLE_CLIENT_ID, client_secret: env.MCP_GOOGLE_CLIENT_SECRET, redirect_uri: `${publicOrigin(env)}/oauth/callback`, code_verifier: data.verifier }),
  });
  ensure(response.ok, "google_login_failed", "Google sign-in could not be completed; start again", 502);
  let tokens: { id_token?: string };
  try { tokens = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 65536))); }
  catch { throw new Error("Invalid Google token response"); }
  ensure(tokens.id_token, "google_login_failed", "Google did not return an identity token", 502);
  let sub: string | undefined;
  try {
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: env.MCP_GOOGLE_CLIENT_ID, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat", "nonce"], maxTokenAge: "10m", clockTolerance: 5 });
    ensure(payload.nonce === data.nonce && (!payload.azp || payload.azp === env.MCP_GOOGLE_CLIENT_ID) && (!Array.isArray(payload.aud) || payload.aud.length <= 1 || payload.azp === env.MCP_GOOGLE_CLIENT_ID), "google_login_failed", "Google identity verification failed", 403);
    sub = payload.sub;
  } catch {
    return new Response("Google identity verification failed. Start a new connection.", { status: 403, headers: pageHeaders(headers) });
  }
  if (sub !== env.MCP_OWNER_GOOGLE_SUB) return new Response("This Google account is not the configured Rawkode Academy owner.", { status: 403, headers: pageHeaders(headers) });
  const { redirectTo } = await oauth.completeAuthorization({ request: original, userId: sub, scope: original.scope, metadata: { label: "Rawkode Academy YouTube" }, props: { ownerSub: sub } satisfies OwnerProps });
  headers.set("location", redirectTo);
  return new Response(null, { status: 302, headers });
}

export async function oauthFetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
  const origin = publicOrigin(env);
  ensure(new URL(request.url).origin === origin, "invalid_origin", "Use the configured public origin", 403);
  const provider = new OAuthProvider<OAuthEnv>({
    apiRoute: "/mcp",
    authorizeEndpoint: `${origin}/oauth/authorize`, tokenEndpoint: `${origin}/oauth/token`, clientRegistrationEndpoint: `${origin}/oauth/register`,
    resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin], resource_name: "Rawkode Academy YouTube" },
    requiredScopes: ["youtube:read"], scopesSupported: SCOPES,
    accessTokenTTL: 3600, refreshTokenTTL: 30 * 86400, clientRegistrationTTL: 30 * 86400,
    clientIdMetadataDocumentEnabled: false,
    onError: ({ code, status, headers }) => Response.json({ error: code, error_description: "Authorization failed; reconnect or check the requested permissions" }, { status, headers: { ...headers, "cache-control": "no-store" } }),
    tokenExchangeCallback: ({ props, env: currentEnv }) => {
      if (props?.ownerSub !== currentEnv.MCP_OWNER_GOOGLE_SUB) throw new OAuthError("invalid_grant", { description: "Owner access changed; reconnect" });
    },
    apiHandler: {
      async fetch(req, currentEnv, executionContext) {
        const authContext = executionContext as OAuthResourceContext<OwnerProps>;
        ensure(new URL(req.url).pathname === "/mcp", "not_found", "Unknown MCP endpoint", 404);
        validateOrigin(req);
        ensure(authContext.props.ownerSub === currentEnv.MCP_OWNER_GOOGLE_SUB, "forbidden", "Owner access changed; reconnect", 403);
        const canWrite = authContext.auth.scope.includes("youtube:publish");
        if (!canWrite && !authContext.auth.scope.includes("youtube:read")) return insufficientScope(authContext.auth, ["youtube:read"]);
        const channel = currentEnv.CHANNELS.getByName(currentEnv.YOUTUBE_CHANNEL_ID);
        const safeRequest = req.body ? new Request(req, { body: await readLimited(req.body, 65536) }) : req;
        return createMcpHandler(() => createServer((operation, input) => channel.invoke(operation, input), canWrite), { corsOptions: false, allowedHostnames: [new URL(origin).hostname], allowedOriginHostnames: [new URL(origin).hostname] })(safeRequest, currentEnv, executionContext);
      },
    },
    defaultHandler: {
      async fetch(req, currentEnv) {
        const path = new URL(req.url).pathname;
        if (path === "/oauth/authorize") return signIn(req, currentEnv);
        if (path === "/oauth/callback") return callback(req, currentEnv);
        return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      },
    },
  });
  try {
    return await provider.fetch(request, env as OAuthEnv, ctx);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      if (error.redirectTo) return new Response(null, { status: 302, headers: { location: error.redirectTo, "cache-control": "no-store", "referrer-policy": "no-referrer" } });
      return Response.json({ error: error.code, message: "Authorization request was rejected; start a new connection" }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    const body = errorBody(error);
    return Response.json(body, { status: body.status, headers: { "cache-control": "no-store" } });
  }
}

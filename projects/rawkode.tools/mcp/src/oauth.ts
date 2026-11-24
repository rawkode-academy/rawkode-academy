import {
  AuthorizationError, OAuthError, OAuthProvider, authorizationErrorRedirect, insufficientScope,
  type ConsentDescription, type OAuthHelpers, type OAuthResourceContext,
} from "@cloudflare/workers-oauth-provider";
import { createMcpHandler } from "agents/mcp/server";
import { ensure, errorBody, readLimited, ServiceError, validateOrigin } from "./errors.ts";
import { authorizeUrl, IDENTITY_ORIGIN, recheckCaller, roleOf, signInCaller, type Caller, type CallerRole } from "./identity.ts";
import { createServer, grantedScopes, MODULE_SCOPES, modulesFor } from "./tools/index.ts";

const SCOPES = [...MODULE_SCOPES, "offline_access"];
type LoginState = { verifier: string };
type OAuthEnv = CloudflareEnv & { OAUTH_PROVIDER: OAuthHelpers };

export function publicOrigin(env: Pick<CloudflareEnv, "PUBLIC_ORIGIN">) {
  let url: URL;
  try { url = new URL(env.PUBLIC_ORIGIN); } catch { throw new ServiceError("not_configured", "MCP public origin is not configured", 503); }
  ensure(url.protocol === "https:" && url.origin === env.PUBLIC_ORIGIN, "not_configured", "PUBLIC_ORIGIN must be a canonical HTTPS origin without a trailing slash", 503);
  return url.origin;
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
export function renderConsent(details: ConsentDescription, handle: string, scopes: readonly string[]) {
  const abilities = modulesFor(scopes).map(module => `<li>${escape(module.description)}</li>`).join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Connect Rawkode Tools</title><style>body{font:18px/1.5 system-ui;max-width:40rem;margin:4rem auto;padding:0 1.5rem;background:#10121b;color:#f5f5fa}h1{line-height:1.2}label{display:block;margin:1.5rem 0}button{font:inherit;padding:.6rem 1rem;margin-right:.6rem}small{color:#b7bdd3}strong{overflow-wrap:anywhere}</style>
  <h1>Connect ${escape(details.clientName)} to Rawkode Tools</h1>
  <p>Access will return to <strong>${escape(details.redirectHost)}</strong>.</p>
  <p>${details.clientDomain ? `Client domain: <strong>${escape(details.clientDomain)}</strong>.` : "The client supplied its own name. Check the return address before continuing."}</p>
  ${details.redirectIsLoopback ? "<p><strong>This returns access to an app on your computer.</strong> Continue only if you started this connection.</p>" : ""}
  <form method="post" action="/oauth/authorize"><input type="hidden" name="handle" value="${escape(handle)}">
  <p>This connection can:</p><ul>${abilities}</ul>
  <p><small>The connection can refresh its access for up to 30 days. Continuing signs you in with your Rawkode Academy account, which needs the Rawkode Tools operator role, or the guest role, which shows only the YouTube numbers of episodes you appear in. No credentials are shared with this client.</small></p>
  <button name="decision" value="approve">Continue with Rawkode Academy</button><button name="decision" value="deny">Cancel</button></form></html>`;
}
// formTargets: origins the consent form's POST may redirect to. Browsers apply form-action to redirects.
function pageHeaders(headers: Headers, formTargets: readonly string[] = []) {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  // Not no-referrer: under it, browsers send `Origin: null` on the form POST, which validateOrigin rejects.
  // same-origin still sends nothing to other sites.
  headers.set("referrer-policy", "same-origin");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", `default-src 'none'; style-src 'unsafe-inline'; form-action ${["'self'", ...formTargets].join(" ")}; base-uri 'none'; frame-ancestors 'none'`);
  headers.set("x-frame-options", "DENY");
  return headers;
}
export async function s256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(bytes).toString("base64url");
}
// The consent page shows the same modules this grants.
function grantScope(requested: string[], role: CallerRole) {
  return [...grantedScopes(requested, role), ...(requested.includes("offline_access") ? ["offline_access"] : [])];
}
async function signIn(request: Request, env: OAuthEnv) {
  const oauth = env.OAUTH_PROVIDER;
  if (request.method === "GET") {
    const original = await oauth.parseAuthRequest(request);
    ensure(original.codeChallenge && original.codeChallengeMethod === "S256", "invalid_request", "S256 PKCE is required");
    ensure(original.scope.every(s => SCOPES.includes(s)), "invalid_scope", "Unsupported OAuth scope");
    const details = await oauth.describeConsent(original);
    const consent = await oauth.beginConsent(original);
    const formTargets = [IDENTITY_ORIGIN, new URL(original.redirectUri).origin];
    return new Response(renderConsent(details, consent.handle, grantedScopes(original.scope)), { headers: pageHeaders(consent.headers, formTargets) });
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
  const approved = await oauth.approveConsent(request, handle);
  const verifier = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const transaction = await oauth.beginUpstream(approved.request, { data: { verifier } satisfies LoginState, headers: approved.headers });
  transaction.headers.set("location", authorizeUrl(`${publicOrigin(env)}/oauth/callback`, transaction.state, await s256(verifier)));
  transaction.headers.set("referrer-policy", "no-referrer");
  return new Response(null, { status: 302, headers: transaction.headers });
}
async function callback(request: Request, env: OAuthEnv) {
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
  ensure(code && code.length <= 4096, "invalid_callback", "Missing authorization code");
  let signedIn: Caller;
  try {
    signedIn = await signInCaller(code, data.verifier, `${publicOrigin(env)}/oauth/callback`);
  } catch (error) {
    const body = errorBody(error);
    return new Response(body.status === 403 ? escape(body.message) : "Rawkode Academy sign-in failed. Start a new connection.", { status: body.status === 403 ? 403 : 502, headers: pageHeaders(headers) });
  }
  const { redirectTo } = await oauth.completeAuthorization({ request: original, userId: signedIn.userId, scope: grantScope(original.scope, roleOf(signedIn)), metadata: { label: "Rawkode Tools" }, props: signedIn satisfies Caller });
  headers.set("location", redirectTo);
  return new Response(null, { status: 302, headers });
}

export async function oauthFetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
  const origin = publicOrigin(env);
  ensure(new URL(request.url).origin === origin, "invalid_origin", "Use the configured public origin", 403);
  const provider = new OAuthProvider<OAuthEnv>({
    apiRoute: "/mcp",
    authorizeEndpoint: `${origin}/oauth/authorize`, tokenEndpoint: `${origin}/oauth/token`, clientRegistrationEndpoint: `${origin}/oauth/register`,
    resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin], resource_name: "Rawkode Tools" },
    scopesSupported: SCOPES,
    accessTokenTTL: 3600, refreshTokenTTL: 30 * 86400, clientRegistrationTTL: 30 * 86400,
    clientIdMetadataDocumentEnabled: false,
    onError: ({ code, status, headers }) => Response.json({ error: code, error_description: "Authorization failed; reconnect or check the requested permissions" }, { status, headers: { ...headers, "cache-control": "no-store" } }),
    tokenExchangeCallback: async ({ grantType, props }) => {
      if (grantType !== "refresh_token") return;
      try { return { newProps: await recheckCaller(props as Caller) }; }
      catch { throw new OAuthError("invalid_grant", { description: "Rawkode Tools access changed; reconnect" }); }
    },
    apiHandler: {
      async fetch(req, currentEnv, executionContext) {
        const authContext = executionContext as OAuthResourceContext<Caller>;
        const caller = authContext.props;
        ensure(new URL(req.url).pathname === "/mcp", "not_found", "Unknown MCP endpoint", 404);
        validateOrigin(req);
        if (modulesFor(authContext.auth.scope, roleOf(caller)).length === 0) return insufficientScope(authContext.auth, MODULE_SCOPES);
        const safeRequest = req.body ? new Request(req, { body: await readLimited(req.body, 65536) }) : req;
        return createMcpHandler(() => createServer(currentEnv, authContext.auth.scope, caller), { corsOptions: false, allowedHostnames: [new URL(origin).hostname], allowedOriginHostnames: [new URL(origin).hostname] })(safeRequest, currentEnv, executionContext);
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

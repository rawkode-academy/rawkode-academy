import assert from "node:assert/strict";
import { Response as MockResponse, type Miniflare } from "miniflare";
import { createHash, randomBytes } from "node:crypto";

export const oauthOrigin = "https://mcp.example.test";
export const operatorId = "operator-user";
const identity = "https://id.rawkode.academy";
// Miniflare's HTTP bridge rewrites Host to 127.0.0.1 even when dispatchFetch's
// public URL differs. Model the public edge before entering the real Worker;
// production host/origin validation remains enabled and unchanged.
export const publicOriginProxy = `export default { fetch(request, env) {
  const headers = new Headers(request.headers);
  headers.set("host", new URL(request.url).host);
  return env.APP.fetch(new Request(request, { headers }));
} };`;
type FetchRequest = { url: string; method: string; headers: { get(name: string): string | null }; text(): Promise<string> };
export type UserOptions = { sub?: string; roles?: string[]; clientId?: string; refresh?: boolean; username?: string };
type Session = { challenge: string; user: UserOptions };

// Stands in for id.rawkode.academy's OIDC provider: authorization codes bound
// to a PKCE challenge, refresh tokens, and userinfo with per-client roles.
export class IdentityMock {
  private codes = new Map<string, Session>();
  private access = new Map<string, UserOptions>();
  private refresh = new Map<string, UserOptions>();
  issueCode(challenge: string, user: UserOptions = {}) {
    const code = randomBytes(24).toString("base64url");
    this.codes.set(code, { challenge, user });
    return code;
  }
  // Changes what userinfo reports for every token already issued.
  update(user: UserOptions) {
    for (const map of [this.access, this.refresh]) for (const value of map.values()) Object.assign(value, user);
  }
  private tokens(user: UserOptions) {
    const access_token = randomBytes(24).toString("base64url");
    this.access.set(access_token, user);
    const refresh_token = user.refresh === false ? undefined : randomBytes(24).toString("base64url");
    if (refresh_token) this.refresh.set(refresh_token, user);
    return MockResponse.json({ access_token, refresh_token, token_type: "Bearer", expires_in: 3600 });
  }
  async handle(request: FetchRequest) {
    const url = new URL(request.url);
    if (url.href === `${identity}/auth/oauth2/userinfo`) {
      const user = this.access.get((request.headers.get("authorization") ?? "").replace(/^Bearer /, ""));
      if (!user) return MockResponse.json({ error: "invalid_token" }, { status: 401 });
      const roles = user.roles ?? ["operator"];
      const clientId = user.clientId ?? "rawkode-tools-mcp";
      return MockResponse.json({ sub: user.sub ?? operatorId, email: "operator@example.test", ...(user.username ? { username: user.username, preferred_username: user.username } : {}), ...(roles.length ? { roles, "https://rawkode.academy/roles": roles, "https://rawkode.academy/client_id": clientId } : {}) });
    }
    if (url.href !== `${identity}/auth/oauth2/token`) return null;
    const parameters = new URLSearchParams(await request.text());
    assert.equal(parameters.get("client_id"), "rawkode-tools-mcp");
    assert.equal(parameters.get("client_secret"), null);
    if (parameters.get("grant_type") === "refresh_token") {
      const user = this.refresh.get(parameters.get("refresh_token") ?? "");
      if (!user) return MockResponse.json({ error: "invalid_grant" }, { status: 400 });
      this.refresh.delete(parameters.get("refresh_token")!);
      return this.tokens(user);
    }
    assert.equal(parameters.get("grant_type"), "authorization_code");
    assert.equal(parameters.get("redirect_uri"), `${oauthOrigin}/oauth/callback`);
    const code = parameters.get("code") ?? "";
    const session = this.codes.get(code);
    this.codes.delete(code);
    const verifier = parameters.get("code_verifier") ?? "";
    if (!session || createHash("sha256").update(verifier).digest("base64url") !== session.challenge) return MockResponse.json({ error: "invalid_grant" }, { status: 400 });
    return this.tokens({ ...session.user });
  }
}

type ResponseLike = { headers: { getSetCookie(): string[] }; status: number; text(): Promise<string> };
export class CookieJar {
  private cookies = new Map<string, string>();
  add(response: ResponseLike) {
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";");
      const split = pair.indexOf("=");
      const name = pair.slice(0, split), value = pair.slice(split + 1);
      if (value) this.cookies.set(name, value); else this.cookies.delete(name);
    }
  }
  value() { return [...this.cookies].map(([key, value]) => `${key}=${value}`).join("; "); }
}
export async function registerOAuthClient(mf: Miniflare, clientName = "ChatGPT test client") {
  const response = await mf.dispatchFetch(`${oauthOrigin}/oauth/register`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_name: clientName, redirect_uris: ["https://chatgpt.example/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  return await response.json() as { client_id: string };
}
export async function beginOwnerLogin(mf: Miniflare) {
  const client = await registerOAuthClient(mf);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const parameters = new URLSearchParams({ client_id: client.client_id, response_type: "code", redirect_uri: "https://chatgpt.example/callback", code_challenge: challenge, code_challenge_method: "S256", scope: "analytics:read offline_access", resource: `${oauthOrigin}/mcp`, state: "downstream-client-state" });
  const response = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${parameters}`);
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  const jar = new CookieJar(); jar.add(response);
  const html = await response.text();
  const handle = html.match(/name="handle" value="([^"]+)"/)?.[1];
  assert.ok(handle);
  const approved = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize`, {
    method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.value(), origin: oauthOrigin },
    body: new URLSearchParams({ handle, decision: "approve" }).toString(),
  });
  // A page that navigates on its own, not a redirect: form-action would stop a redirect chain that ends at GitHub.
  assert.equal(approved.status, 200, await approved.clone().text());
  assert.equal(approved.headers.get("location"), null);
  assert.match(approved.headers.get("content-security-policy") ?? "", /form-action 'self';/);
  jar.add(approved);
  const approvedHtml = await approved.text();
  const target = approvedHtml.match(/http-equiv="refresh" content="0;url=([^"]+)"/)?.[1];
  assert.ok(target, approvedHtml);
  const signInURL = new URL(target.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code))));
  assert.equal(signInURL.origin + signInURL.pathname, `${identity}/auth/oauth2/authorize`);
  assert.equal(signInURL.searchParams.get("client_id"), "rawkode-tools-mcp");
  assert.equal(signInURL.searchParams.get("redirect_uri"), `${oauthOrigin}/oauth/callback`);
  assert.equal(signInURL.searchParams.get("code_challenge_method"), "S256");
  return { clientId: client.client_id, verifier, jar, challenge: signInURL.searchParams.get("code_challenge")!, state: signInURL.searchParams.get("state")! };
}
export type OAuthPending = Awaited<ReturnType<typeof beginOwnerLogin>>;
export async function completeOwnerLogin(mf: Miniflare, identity: IdentityMock, pending: OAuthPending, user: UserOptions = {}) {
  const code = identity.issueCode(pending.challenge, user);
  const callbackURL = `${oauthOrigin}/oauth/callback?${new URLSearchParams({ state: pending.state, code })}`;
  const response = await mf.dispatchFetch(callbackURL, { redirect: "manual", headers: { cookie: pending.jar.value() } });
  pending.jar.add(response);
  return { response, callbackURL };
}
export async function exchangeCode(mf: Miniflare, pending: OAuthPending, code: string, verifier = pending.verifier) {
  return mf.dispatchFetch(`${oauthOrigin}/oauth/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: pending.clientId, code, code_verifier: verifier, redirect_uri: "https://chatgpt.example/callback", resource: `${oauthOrigin}/mcp` }).toString(),
  });
}
export async function authorizedMcp(mf: Miniflare, identity: IdentityMock, user: UserOptions = {}) {
  const pending = await beginOwnerLogin(mf);
  const { response } = await completeOwnerLogin(mf, identity, pending, user);
  assert.equal(response.status, 302, await response.clone().text());
  const redirect = new URL(response.headers.get("location")!);
  assert.equal(redirect.searchParams.get("state"), "downstream-client-state");
  const code = redirect.searchParams.get("code")!;
  assert.ok(code);
  const tokenResponse = await exchangeCode(mf, pending, code);
  assert.equal(tokenResponse.status, 200, await tokenResponse.clone().text());
  const tokens = await tokenResponse.json() as { access_token: string; refresh_token: string; scope: string; token_type: string };
  return { ...tokens, clientId: pending.clientId, pending, code };
}
export async function mcpRequest(mf: Miniflare, token: string, method: string, params: unknown = {}) {
  const worker = await mf.getWorker();
  return worker.fetch(`${oauthOrigin}/mcp`, {
    method: "POST", headers: { host: new URL(oauthOrigin).host, authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2025-11-25" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method, params }),
  });
}
export async function readMcp(response: { text(): Promise<string> }): Promise<Record<string, any>> {
  const body = await response.text();
  if (body.trimStart().startsWith("{")) return JSON.parse(body);
  const messages = body.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => JSON.parse(line.slice(5).trim()));
  const result = messages.find(message => message.id !== undefined);
  assert.ok(result, "MCP SSE response must contain a JSON-RPC result");
  return result;
}

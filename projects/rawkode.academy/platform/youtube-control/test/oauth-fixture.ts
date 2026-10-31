import assert from "node:assert/strict";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { Response as MockResponse, type Miniflare } from "miniflare";
import { createHash, randomBytes } from "node:crypto";

export const oauthOrigin = "https://poc.example.test";
export const oauthOwner = "owner-sub";
export const oauthClient = "test-mcp-client";
// Miniflare's HTTP bridge rewrites Host to 127.0.0.1 even when dispatchFetch's
// public URL differs. Model the public edge before entering the real Worker;
// production host/origin validation remains enabled and unchanged.
export const publicOriginProxy = `export default { fetch(request, env) {
  const headers = new Headers(request.headers);
  headers.set("host", new URL(request.url).host);
  return env.APP.fetch(new Request(request, { headers }));
} };`;
type FetchRequest = { url: string; method: string; text(): Promise<string> };
type IdentityOptions = { sub?: string; nonce?: string; audience?: string; issuer?: string };
export class GoogleLoginMock {
  private codes = new Map<string, { nonce: string; identity: IdentityOptions }>();
  private constructor(private privateKey: CryptoKey, private jwk: Record<string, unknown>) {}
  static async create() {
    const pair = await generateKeyPair("RS256");
    const jwk = { ...await exportJWK(pair.publicKey), kid: crypto.randomUUID(), alg: "RS256", use: "sig" };
    return new GoogleLoginMock(pair.privateKey, jwk);
  }
  issueCode(nonce: string, identity: IdentityOptions = {}) {
    const code = randomBytes(24).toString("base64url");
    this.codes.set(code, { nonce, identity });
    return code;
  }
  async handle(request: FetchRequest) {
    const url = new URL(request.url);
    if (url.href === "https://www.googleapis.com/oauth2/v3/certs") return MockResponse.json({ keys: [this.jwk] });
    if (url.href !== "https://oauth2.googleapis.com/token") return null;
    const parameters = new URLSearchParams(await request.text());
    if (parameters.get("grant_type") !== "authorization_code") return null;
    assert.equal(parameters.get("client_id"), oauthClient);
    assert.equal(parameters.get("client_secret"), "test-mcp-secret");
    assert.equal(parameters.get("redirect_uri"), `${oauthOrigin}/oauth/callback`);
    assert.match(parameters.get("code_verifier") ?? "", /^[A-Za-z0-9_-]{43}$/);
    const code = parameters.get("code") ?? "";
    const value = this.codes.get(code);
    this.codes.delete(code);
    if (!value) return MockResponse.json({ error: "invalid_grant" }, { status: 400 });
    const { identity } = value;
    const token = await new SignJWT({ nonce: identity.nonce ?? value.nonce })
      .setProtectedHeader({ alg: "RS256", kid: this.jwk.kid as string })
      .setSubject(identity.sub ?? oauthOwner).setIssuer(identity.issuer ?? "https://accounts.google.com")
      .setAudience(identity.audience ?? oauthClient).setIssuedAt().setExpirationTime("5m").sign(this.privateKey);
    return MockResponse.json({ id_token: token, access_token: "test-upstream-access-token", token_type: "Bearer", expires_in: 300 });
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
export async function beginOwnerLogin(mf: Miniflare, publish = false) {
  const client = await registerOAuthClient(mf);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const parameters = new URLSearchParams({ client_id: client.client_id, response_type: "code", redirect_uri: "https://chatgpt.example/callback", code_challenge: challenge, code_challenge_method: "S256", scope: "youtube:read offline_access", resource: `${oauthOrigin}/mcp`, state: "downstream-client-state" });
  const response = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${parameters}`);
  assert.equal(response.status, 200, await response.clone().text());
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  const jar = new CookieJar(); jar.add(response);
  const html = await response.text();
  const handle = html.match(/name="handle" value="([^"]+)"/)?.[1];
  assert.ok(handle);
  const approved = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize`, {
    method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.value(), origin: oauthOrigin },
    body: new URLSearchParams({ handle, decision: "approve", ...(publish ? { publish: "yes" } : {}) }).toString(),
  });
  assert.equal(approved.status, 302, await approved.clone().text());
  jar.add(approved);
  const googleURL = new URL(approved.headers.get("location")!);
  assert.equal(googleURL.origin, "https://accounts.google.com");
  assert.equal(googleURL.searchParams.get("code_challenge_method"), "S256");
  assert.equal(googleURL.searchParams.get("scope"), "openid");
  return { clientId: client.client_id, verifier, jar, nonce: googleURL.searchParams.get("nonce")!, state: googleURL.searchParams.get("state")! };
}
export type OAuthPending = Awaited<ReturnType<typeof beginOwnerLogin>>;
export async function completeOwnerLogin(mf: Miniflare, google: GoogleLoginMock, pending: OAuthPending, identity: IdentityOptions = {}) {
  const code = google.issueCode(pending.nonce, identity);
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
export async function authorizedMcp(mf: Miniflare, google: GoogleLoginMock, publish = false) {
  const pending = await beginOwnerLogin(mf, publish);
  const { response } = await completeOwnerLogin(mf, google, pending);
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

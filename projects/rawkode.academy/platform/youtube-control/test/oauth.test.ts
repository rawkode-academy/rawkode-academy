import test from "node:test";
import assert from "node:assert/strict";
import { URL as NodeURL, fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare, Request as MockRequest, Response as MockResponse } from "miniflare";
import { authorizedMcp, beginOwnerLogin, completeOwnerLogin, exchangeCode, GoogleLoginMock, mcpRequest, oauthClient, oauthOrigin, oauthOwner, publicOriginProxy, readMcp, registerOAuthClient } from "./oauth-fixture.ts";

const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
type Json = Record<string, any>;

test("OAuth protects ChatGPT MCP with owner login, PKCE, consent and resource scopes", async t => {
  const google = await GoogleLoginMock.create();
  const unexpected: string[] = [];
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "edge-proxy", modules: true, script: publicOriginProxy, serviceBindings: { APP: "youtube-oauth-test" }, compatibilityDate: "2026-10-31" }, {
    name: "youtube-oauth-test", modules: true, scriptPath: fileURLToPath(new NodeURL("../dist/main.js", import.meta.url)),
    compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
    kvNamespaces: ["OAUTH_KV"], r2Buckets: ["ASSETS", "ANALYTICS_RAW"],
    durableObjects: { CHANNELS: { className: "YouTubeChannel", useSQLite: true } },
    bindings: { PUBLIC_ORIGIN: oauthOrigin, MCP_OWNER_GOOGLE_SUB: oauthOwner, MCP_GOOGLE_CLIENT_ID: oauthClient, MCP_GOOGLE_CLIENT_SECRET: "test-mcp-secret", YOUTUBE_CHANNEL_ID: channelId, YOUTUBE_CREDENTIALS_JSON: JSON.stringify({ client_id: "test-youtube-client", client_secret: "test-youtube-secret", refresh_token: "test-youtube-refresh" }), READ_API_TOKEN: "r".repeat(32), WRITE_API_TOKEN: "w".repeat(32) },
    outboundService: async (request: MockRequest) => {
      const response = await google.handle(request.clone());
      if (response) return response;
      const url = new URL(request.url);
      if (url.href === "https://oauth2.googleapis.com/token") return MockResponse.json({ access_token: "youtube-access", expires_in: 3600 });
      if (url.pathname === "/youtube/v3/channels") return MockResponse.json({ items: [{ id: channelId }] });
      if (url.pathname === "/youtube/v3/liveBroadcasts") return MockResponse.json({ items: [{ id: "testvideo01", snippet: { channelId, title: "Test broadcast", description: "Fixture", scheduledStartTime: "2030-01-01T17:00:00Z" }, status: { privacyStatus: "private", selfDeclaredMadeForKids: false, lifeCycleStatus: "created" } }] });
      unexpected.push(url.origin + url.pathname);
      return MockResponse.json({ error: "Unexpected outbound destination" }, { status: 599 });
    },
  }] }));
  t.after(async () => { await mf.dispose(); assert.deepEqual(unexpected, []); });

  await t.test("unauthenticated and script tokens receive OAuth discovery, never MCP access", async () => {
    for (const token of ["missing", "r".repeat(32), "test-upstream-access-token"]) {
      const result = await mcpRequest(mf, token, "tools/list");
      assert.equal(result.status, 401);
      assert.match(result.headers.get("www-authenticate") ?? "", /resource_metadata=/);
    }
    const resource = await mf.dispatchFetch(`${oauthOrigin}/.well-known/oauth-protected-resource/mcp`);
    assert.equal(resource.status, 200);
    assert.equal((await resource.json() as Json).resource, `${oauthOrigin}/mcp`);
    const metadata = await mf.dispatchFetch(`${oauthOrigin}/.well-known/oauth-authorization-server`);
    const body = await metadata.json() as Json;
    assert.equal(body.registration_endpoint, `${oauthOrigin}/oauth/register`);
    assert.equal(body.token_endpoint, `${oauthOrigin}/oauth/token`);
    assert.ok(body.code_challenge_methods_supported.includes("S256"));
  });

  await t.test("missing PKCE and invalid redirect requests cannot begin sign-in", async () => {
    const { client_id } = await registerOAuthClient(mf);
    for (const redirect_uri of ["https://chatgpt.example/callback", "https://attacker.example/callback"]) {
      const response = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${new URLSearchParams({ response_type: "code", client_id, redirect_uri, scope: "youtube:read" })}`, { redirect: "manual" });
      assert.ok(response.status === 400 || response.status === 302);
      assert.ok(!(response.headers.get("location") ?? "").startsWith("https://accounts.google.com"));
      assert.ok(!(response.headers.get("location") ?? "").startsWith("https://attacker.example"));
    }
  });

  await t.test("read-only owner consent exposes reads and planning but no publishing tool", async () => {
    const auth = await authorizedMcp(mf, google);
    assert.ok(auth.refresh_token);
    assert.ok(!auth.scope.includes("youtube:publish"));
    const initialized = await mcpRequest(mf, auth.access_token, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "ChatGPT integration test", version: "1.0.0" } });
    assert.equal(initialized.status, 200);
    const handshake = await readMcp(initialized);
    assert.equal(handshake.result.protocolVersion, "2025-11-25");
    assert.equal(handshake.result.serverInfo.name, "rawkode-academy-youtube");
    assert.ok(handshake.result.capabilities.tools);
    const listResponse = await mcpRequest(mf, auth.access_token, "tools/list");
    assert.equal(listResponse.status, 200, await listResponse.clone().text());
    const list = await readMcp(listResponse);
    assert.deepEqual(list.result.tools.map((tool: Json) => tool.name).sort(), ["get_analytics", "get_broadcast", "plan_session"]);
    const denied = await mcpRequest(mf, auth.access_token, "tools/call", { name: "apply_session", arguments: { planId: crypto.randomUUID() } });
    const deniedBody = await readMcp(denied);
    assert.ok(deniedBody.error || deniedBody.result?.isError);
    const current = await mcpRequest(mf, auth.access_token, "tools/call", { name: "get_broadcast", arguments: { broadcastId: "testvideo01" } });
    assert.equal(current.status, 200);
    const currentBody = await readMcp(current);
    assert.equal(currentBody.result.isError, false, JSON.stringify(currentBody));
    assert.equal(JSON.parse(currentBody.result.content[0].text).title, "Test broadcast");
    const replay = await exchangeCode(mf, auth.pending, auth.code);
    assert.equal(replay.status, 400);
  });

  await t.test("untrusted client metadata is escaped and publishing consent cannot be forged", async () => {
    const { client_id } = await registerOAuthClient(mf, "<script>attack()</script>");
    const parameters = new URLSearchParams({ response_type: "code", client_id, redirect_uri: "https://chatgpt.example/callback", scope: "youtube:read youtube:publish", code_challenge: "a".repeat(43), code_challenge_method: "S256", resource: `${oauthOrigin}/mcp` });
    const consent = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${parameters}`);
    assert.equal(consent.status, 200);
    const html = await consent.text();
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&#60;script&#62;"));
    assert.ok(!/name="publish"[^>]*\bchecked\b/.test(html));
    const handle = html.match(/name="handle" value="([^"]+)"/)?.[1];
    assert.ok(handle);
    const forged = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", origin: oauthOrigin }, body: new URLSearchParams({ decision: "approve", publish: "yes", handle }).toString() });
    assert.equal(forged.status, 400);
    assert.equal(forged.headers.get("location"), null);
  });

  await t.test("explicit publishing consent exposes the write tool and refresh preserves the scope", async () => {
    const auth = await authorizedMcp(mf, google, true);
    assert.ok(auth.scope.includes("youtube:publish"));
    const listed = await mcpRequest(mf, auth.access_token, "tools/list");
    const list = await readMcp(listed);
    const publish = list.result.tools.find((tool: Json) => tool.name === "apply_session");
    assert.equal(publish.annotations.readOnlyHint, false);
    assert.equal(publish.annotations.destructiveHint, true);
    const refresh = await mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: auth.clientId, refresh_token: auth.refresh_token, resource: `${oauthOrigin}/mcp` }).toString() });
    assert.equal(refresh.status, 200, await refresh.clone().text());
    const refreshed = await refresh.json() as Json;
    assert.notEqual(refreshed.access_token, auth.access_token);
    assert.ok(refreshed.scope.includes("youtube:publish"));
    const revoked = await mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshed.access_token, token_type_hint: "access_token", client_id: auth.clientId }).toString() });
    assert.equal(revoked.status, 200, await revoked.clone().text());
    assert.equal((await mcpRequest(mf, refreshed.access_token, "tools/list")).status, 401);
  });

  await t.test("browser-bound upstream state rejects a callback without its cookie", async () => {
    const pending = await beginOwnerLogin(mf);
    const code = google.issueCode(pending.nonce);
    const callback = await mf.dispatchFetch(`${oauthOrigin}/oauth/callback?${new URLSearchParams({ state: pending.state, code })}`, { redirect: "manual" });
    assert.equal(callback.status, 400);
    assert.equal(callback.headers.get("location"), null);
  });

  await t.test("wrong owner, audience and nonce cannot issue downstream authorization", async () => {
    for (const identity of [{ sub: "another-owner" }, { audience: "another-client" }, { nonce: "incorrect-nonce" }, { issuer: "https://attacker.example" }]) {
      const pending = await beginOwnerLogin(mf);
      const { response } = await completeOwnerLogin(mf, google, pending, identity);
      assert.equal(response.status, 403, await response.clone().text());
      assert.equal(response.headers.get("location"), null);
    }
  });

  await t.test("a wrong downstream PKCE verifier cannot exchange an authorization code", async () => {
    const pending = await beginOwnerLogin(mf);
    const { response } = await completeOwnerLogin(mf, google, pending);
    assert.equal(response.status, 302, await response.clone().text());
    const code = new URL(response.headers.get("location")!).searchParams.get("code")!;
    const token = await exchangeCode(mf, pending, code, "x".repeat(43));
    assert.equal(token.status, 400);
    assert.equal((await token.json() as Json).error, "invalid_grant");
  });
});

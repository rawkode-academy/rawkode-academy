import test from "node:test";
import assert from "node:assert/strict";
import { URL as NodeURL, fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare, Request as MockRequest, Response as MockResponse } from "miniflare";
import { authorizedMcp, beginOwnerLogin, completeOwnerLogin, exchangeCode, IdentityMock, mcpRequest, oauthOrigin, publicOriginProxy, readMcp, registerOAuthClient } from "./oauth-fixture.ts";

type Json = Record<string, any>;
const academyAPI = "https://api.rawkode.academy/";
const person = (id: string, githubHandle: string | null = id) => ({ id, githubHandle });
// Who guested on what: icepuma guests on "intar" (matched to YouTube by title)
// and hosts "icepuma-show"; "other" is somebody else's episode.
const academyVideos = [
  { id: "intar", title: "Intar Office Hours", slug: "intar", publishedAt: "2026-06-01T00:00:00.000Z", youtubeId: null, guests: [person("icepuma")], episode: { show: { id: "office-hours", hosts: [person("rawkode")] } } },
  { id: "other", title: "Someone Else", slug: "other", publishedAt: "2026-05-01T00:00:00.000Z", youtubeId: "BBBBBBBBBBB", guests: [person("someone")], episode: { show: { id: "office-hours", hosts: [person("rawkode")] } } },
  { id: "ip-1", title: "Ice Show One", slug: "ip-1", publishedAt: "2026-04-01T00:00:00.000Z", youtubeId: "AAAAAAAAAAA", guests: [], episode: { show: { id: "icepuma-show", hosts: [person("icepuma")] } } },
  { id: "ip-2", title: "Ice Show Two", slug: "ip-2", publishedAt: "2026-04-08T00:00:00.000Z", youtubeId: null, guests: [], episode: { show: { id: "icepuma-show", hosts: [person("icepuma")] } } },
];
const lakeCatalogue = [{ video: "INTARvideo1", title: "Intar Office Hours!" }, { video: "BBBBBBBBBBB", title: "Someone Else" }, { video: "AAAAAAAAAAA", title: "Ice Show One" }];
const basinURL = "https://api.sql.cloudflarestorage.com/api/v1/accounts/0aeb879de8e3cdde5fb3d413025222ce/basin-sql/query/rawkode-analytics";

test("OAuth protects the analytics MCP with owner login, PKCE, consent and resource scopes", async t => {
  const identity = new IdentityMock();
  const unexpected: string[] = [];
  const queries: string[] = [];
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: "edge-proxy", modules: true, script: publicOriginProxy, serviceBindings: { APP: "mcp-test" }, compatibilityDate: "2026-10-31" }, {
    name: "mcp-test", modules: true, scriptPath: fileURLToPath(new NodeURL("../dist/main.js", import.meta.url)),
    compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
    kvNamespaces: ["OAUTH_KV"],
    bindings: { PUBLIC_ORIGIN: oauthOrigin, BASIN_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce", BASIN_BUCKET: "rawkode-analytics", BASIN_SQL_TOKEN: "test-basin-token" },
    outboundService: async (request: MockRequest) => {
      const response = await identity.handle(request.clone());
      if (response) return response;
      if (request.url === academyAPI) return MockResponse.json({ data: { getAllVideos: academyVideos } });
      if (request.url === basinURL) {
        assert.equal(request.headers.get("authorization"), "Bearer test-basin-token");
        const { query } = await request.json() as { query: string };
        queries.push(query);
        if (query.includes("event_type = 'youtube.video'")) return MockResponse.json({ success: true, result: { rows: lakeCatalogue } });
        if (query.includes("youtube.video_daily")) return MockResponse.json({ success: true, result: { rows: [{ video: "AAAAAAAAAAA", day: "2026-11-20", views: 7 }] } });
        if (query.includes("no_such_column")) return MockResponse.json({ success: false, errors: [{ message: "Schema error: No field named no_such_column" }] }, { status: 400 });
        return MockResponse.json({ success: true, result: { schema: [{ name: "day" }, { name: "views" }], rows: [["2026-11-20", 123], ["2026-11-21", 456]] } });
      }
      unexpected.push(new URL(request.url).origin + new URL(request.url).pathname);
      return MockResponse.json({ error: "Unexpected outbound destination" }, { status: 599 });
    },
  }] }));
  t.after(async () => { await mf.dispose(); assert.deepEqual(unexpected, []); });

  await t.test("unauthenticated and script tokens receive OAuth discovery, never MCP access", async () => {
    for (const token of ["missing", "test-basin-token", "test-upstream-access-token"]) {
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
      const response = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${new URLSearchParams({ response_type: "code", client_id, redirect_uri, scope: "analytics:read" })}`, { redirect: "manual" });
      assert.ok(response.status === 400 || response.status === 302);
      assert.notEqual(URL.parse(response.headers.get("location") ?? "")?.hostname, "id.rawkode.academy");
      assert.notEqual(URL.parse(response.headers.get("location") ?? "")?.hostname, "attacker.example");
    }
  });

  await t.test("owner consent exposes only the read-only analytics tools, backed by Basin SQL", async () => {
    const auth = await authorizedMcp(mf, identity);
    assert.ok(auth.refresh_token);
    assert.deepEqual(auth.scope.split(" ").sort(), ["analytics:read", "offline_access"]);
    const initialized = await mcpRequest(mf, auth.access_token, "initialize", { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "MCP integration test", version: "1.0.0" } });
    assert.equal(initialized.status, 200);
    const handshake = await readMcp(initialized);
    assert.equal(handshake.result.protocolVersion, "2025-11-25");
    assert.equal(handshake.result.serverInfo.name, "rawkode-tools");
    const list = await readMcp(await mcpRequest(mf, auth.access_token, "tools/list"));
    assert.deepEqual(list.result.tools.map((tool: Json) => tool.name).sort(), ["describe_analytics", "query_analytics", "youtube_daily", "youtube_traffic"]);
    for (const tool of list.result.tools) assert.equal(tool.annotations.readOnlyHint, true, tool.name);

    const guide = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "describe_analytics", arguments: {} }));
    assert.match(guide.result.content[0].text, /analytics\.events_archive/);

    const daily = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "youtube_daily", arguments: { startDate: "2026-11-20", endDate: "2026-11-21" } }));
    assert.equal(daily.result.isError, false, JSON.stringify(daily));
    assert.deepEqual(JSON.parse(daily.result.content[0].text), { rows: [{ day: "2026-11-20", views: 123 }, { day: "2026-11-21", views: 456 }], rowCount: 2, truncated: false });
    assert.match(queries.at(-1)!, /youtube\.daily'[\s\S]*BETWEEN '2026-11-20' AND '2026-11-21'/);

    const invalidRange = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "youtube_traffic", arguments: { startDate: "2026-11-21", endDate: "2026-11-20" } }));
    assert.ok(invalidRange.error || invalidRange.result?.isError);

    const sql = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "query_analytics", arguments: { sql: "SELECT event_type, count(*) FROM analytics.events_archive GROUP BY event_type;" } }));
    assert.equal(sql.result.isError, false, JSON.stringify(sql));
    assert.equal(queries.at(-1), "SELECT event_type, count(*) FROM analytics.events_archive GROUP BY event_type");

    const before = queries.length;
    for (const statement of ["DROP TABLE analytics.events_archive", "SELECT 1; DROP TABLE analytics.events_archive"]) {
      const rejected = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "query_analytics", arguments: { sql: statement } }));
      assert.equal(rejected.result.isError, true);
      assert.equal(JSON.parse(rejected.result.content[0].text).error, "invalid_query");
    }
    assert.equal(queries.length, before, "rejected statements never reach Basin");

    const failed = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "query_analytics", arguments: { sql: "SELECT no_such_column FROM analytics.events_archive" } }));
    assert.equal(failed.result.isError, true);
    assert.match(JSON.parse(failed.result.content[0].text).message, /No field named no_such_column/);

    const replay = await exchangeCode(mf, auth.pending, auth.code);
    assert.equal(replay.status, 400);
  });

  await t.test("a guest gets only the guest tools, scoped to their own episodes, and no SQL", async () => {
    const auth = await authorizedMcp(mf, identity, { sub: "guest-user", roles: ["guest"], username: "icepuma" });
    assert.deepEqual(auth.scope.split(" ").sort(), ["guest:read", "offline_access"], "asking for analytics:read grants the guest module instead");
    const list = await readMcp(await mcpRequest(mf, auth.access_token, "tools/list"));
    assert.deepEqual(list.result.tools.map((tool: Json) => tool.name).sort(), ["my_episode_daily", "my_episodes"]);
    for (const tool of list.result.tools) assert.equal(tool.annotations.readOnlyHint, true, tool.name);

    for (const name of ["query_analytics", "youtube_daily", "describe_analytics"]) {
      const refused = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name, arguments: { sql: "SELECT 1", startDate: "2026-11-20", endDate: "2026-11-21" } }));
      assert.ok(refused.error || refused.result?.isError, `${name} is not available to a guest`);
    }

    const episodes = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "my_episodes", arguments: {} }));
    assert.equal(episodes.result.isError, false, JSON.stringify(episodes));
    const mine = JSON.parse(episodes.result.content[0].text);
    assert.deepEqual(mine.episodes.map((e: Json) => [e.slug, e.role, e.youtubeVideoId]), [["intar", "guest", "INTARvideo1"], ["ip-2", "host", null], ["ip-1", "host", "AAAAAAAAAAA"]]);
    assert.equal(mine.withoutYouTubeNumbers, 1);
    assert.ok(!JSON.stringify(mine).includes("someone") && !JSON.stringify(mine).includes("rawkode"), "other people and episodes are not exposed");

    const daily = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "my_episode_daily", arguments: { startDate: "2026-11-01", endDate: "2026-11-30" } }));
    assert.equal(daily.result.isError, false, JSON.stringify(daily));
    assert.deepEqual(JSON.parse(daily.result.content[0].text).rows, [{ title: "Ice Show One", video: "AAAAAAAAAAA", day: "2026-11-20", views: 7 }]);
    const sql = queries.at(-1)!;
    assert.match(sql, /IN \('INTARvideo1', 'AAAAAAAAAAA'\)/);
    assert.ok(!sql.includes("BBBBBBBBBBB"), "another guest's video is never queried");

    const own = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "my_episode_daily", arguments: { startDate: "2026-11-01", endDate: "2026-11-30", videoId: "AAAAAAAAAAA" } }));
    assert.equal(own.result.isError, false);
    assert.match(queries.at(-1)!, /IN \('AAAAAAAAAAA'\)/);
    const before = queries.length;
    const foreign = await readMcp(await mcpRequest(mf, auth.access_token, "tools/call", { name: "my_episode_daily", arguments: { startDate: "2026-11-01", endDate: "2026-11-30", videoId: "BBBBBBBBBBB" } }));
    assert.equal(foreign.result.isError, true);
    assert.equal(JSON.parse(foreign.result.content[0].text).error, "forbidden");
    assert.equal(queries.length, before, "a video that isn't theirs never reaches Basin");

    const refresh = await mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: auth.clientId, refresh_token: auth.refresh_token, resource: `${oauthOrigin}/mcp` }).toString() });
    assert.equal(refresh.status, 200, await refresh.clone().text());
    assert.ok(!((await refresh.json() as Json).scope as string).includes("analytics:read"));
  });

  await t.test("a guest without a verified GitHub username is refused, and a role change needs a new connection", async () => {
    const pending = await beginOwnerLogin(mf);
    const { response } = await completeOwnerLogin(mf, identity, pending, { roles: ["guest"] });
    assert.equal(response.status, 403, await response.clone().text());
    assert.match(await response.text(), /no verified GitHub username/);

    const auth = await authorizedMcp(mf, identity, { roles: ["guest"], username: "icepuma" });
    identity.update({ roles: ["operator"] });
    const refresh = await mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: auth.clientId, refresh_token: auth.refresh_token, resource: `${oauthOrigin}/mcp` }).toString() });
    assert.equal(refresh.status, 400);
    assert.equal(((await refresh.json()) as Json).error, "invalid_grant");
  });

  await t.test("untrusted client metadata is escaped and unknown scopes cannot begin sign-in", async () => {
    const { client_id } = await registerOAuthClient(mf, "<script>attack()</script>");
    const parameters = new URLSearchParams({ response_type: "code", client_id, redirect_uri: "https://chatgpt.example/callback", scope: "analytics:read", code_challenge: "a".repeat(43), code_challenge_method: "S256", resource: `${oauthOrigin}/mcp` });
    const consent = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${parameters}`);
    assert.equal(consent.status, 200);
    const html = await consent.text();
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("&#60;script&#62;"));
    // Under no-referrer browsers POST the form with `Origin: null`, which the origin check rejects.
    assert.equal(consent.headers.get("referrer-policy"), "same-origin");
    // form-action also governs the POST's redirects: to identity on approve, to the client on deny.
    assert.match(consent.headers.get("content-security-policy") ?? "", /form-action 'self' https:\/\/id\.rawkode\.academy https:\/\/chatgpt\.example;/);
    parameters.set("scope", "analytics:read youtube:publish");
    const widened = await mf.dispatchFetch(`${oauthOrigin}/oauth/authorize?${parameters}`, { redirect: "manual" });
    assert.notEqual(widened.status, 200);
    assert.notEqual(URL.parse(widened.headers.get("location") ?? "")?.hostname, "id.rawkode.academy");
  });

  await t.test("refresh keeps the scope and revocation ends MCP access", async () => {
    const auth = await authorizedMcp(mf, identity);
    const refresh = await mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: auth.clientId, refresh_token: auth.refresh_token, resource: `${oauthOrigin}/mcp` }).toString() });
    assert.equal(refresh.status, 200, await refresh.clone().text());
    const refreshed = await refresh.json() as Json;
    assert.notEqual(refreshed.access_token, auth.access_token);
    assert.ok(refreshed.scope.includes("analytics:read"));
    const revoked = await mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshed.access_token, token_type_hint: "access_token", client_id: auth.clientId }).toString() });
    assert.equal(revoked.status, 200, await revoked.clone().text());
    assert.equal((await mcpRequest(mf, refreshed.access_token, "tools/list")).status, 401);
  });

  await t.test("refresh re-checks the operator role with the identity service", async () => {
    const refresh = (clientId: string, refresh_token: string) => mf.dispatchFetch(`${oauthOrigin}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId, refresh_token, resource: `${oauthOrigin}/mcp` }).toString() });
    const auth = await authorizedMcp(mf, identity);
    const first = await refresh(auth.clientId, auth.refresh_token);
    assert.equal(first.status, 200, await first.clone().text());
    const rotated = await first.json() as Json;
    identity.update({ roles: [] });
    const removed = await refresh(auth.clientId, rotated.refresh_token);
    assert.equal(removed.status, 400);
    assert.equal((await removed.json() as Json).error, "invalid_grant");
    identity.update({ roles: ["operator"] });
  });

  await t.test("browser-bound upstream state rejects a callback without its cookie", async () => {
    const pending = await beginOwnerLogin(mf);
    const code = identity.issueCode(pending.challenge);
    const callback = await mf.dispatchFetch(`${oauthOrigin}/oauth/callback?${new URLSearchParams({ state: pending.state, code })}`, { redirect: "manual" });
    assert.equal(callback.status, 400);
    assert.equal(callback.headers.get("location"), null);
  });

  await t.test("accounts without the operator role for this client cannot issue downstream authorization", async () => {
    for (const user of [{ roles: [] }, { roles: ["admin"] }, { clientId: "rawkode-studio" }]) {
      const pending = await beginOwnerLogin(mf);
      const { response } = await completeOwnerLogin(mf, identity, pending, user);
      assert.equal(response.status, 403, await response.clone().text());
      const page = await response.text();
      assert.match(page, /Identity user: [^ .]+\. Client claim: [^ ]+\. Roles: [^.]+\./);
      assert.ok(!page.includes("@"), "the denial page shows no email");
      assert.equal(response.headers.get("location"), null);
    }
  });

  await t.test("a wrong downstream PKCE verifier cannot exchange an authorization code", async () => {
    const pending = await beginOwnerLogin(mf);
    const { response } = await completeOwnerLogin(mf, identity, pending);
    assert.equal(response.status, 302, await response.clone().text());
    const code = new URL(response.headers.get("location")!).searchParams.get("code")!;
    const token = await exchangeCode(mf, pending, code, "x".repeat(43));
    assert.equal(token.status, 400);
    assert.equal((await token.json() as Json).error, "invalid_grant");
  });
});

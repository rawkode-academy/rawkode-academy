import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { test } from "node:test";
import { Miniflare, Response, convertV4MiniflareOptions, type Request } from "miniflare";
import { authorizedMcp, GoogleLoginMock, mcpRequest, publicOriginProxy, readMcp } from "./oauth-fixture.ts";

const origin = "https://poc.example.test";
const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const readToken = "read-" + "r".repeat(40);
const writeToken = "write-" + "w".repeat(40);
const accountId = "a".repeat(32);
const streamId = "b".repeat(32);
const subscriptionId = "c".repeat(32);
type Json = Record<string, any>;

class Upstreams {
  constructor(private googleLogin?: GoogleLoginMock) {}
  broadcasts = new Map<string, Json>();
  calls: { host: string; path: string; method: string }[] = [];
  createCount = 0;
  updateCount = 0;
  thumbnailCount = 0;
  analyticsCount = 0;
  refreshCount = 0;
  channelChecks = 0;
  views = 123;
  failNextAck = false;
  failNextProduce = false;
  channelUnavailable = false;
  k2Records: Json[] = [];
  leased: Json[] = [];
  pipelineRecords: Json[] = [];
  lastUpdate: Json | null = null;
  unexpected: string[] = [];

  async fetch(request: Request) {
    const url = new URL(request.url);
    const method = request.method;
    this.calls.push({ host: url.hostname, path: url.pathname, method });
    const loginResponse = await this.googleLogin?.handle(request.clone());
    if (loginResponse) return loginResponse;
    const json = (body: unknown, status = 200) => Response.json(body, { status });
    if (url.hostname === "mock.internal" && url.pathname === "/k2-produce") {
      if (this.failNextProduce) { this.failNextProduce = false; return json({ success: false, error: { code: 10211, retryable: true } }); }
      this.k2Records.push(...await request.json() as Json[]);
      return json({ success: true });
    }
    if (url.hostname === "mock.internal" && url.pathname === "/pipeline-send") {
      this.pipelineRecords.push(...await request.json() as Json[]);
      return json({ success: true });
    }
    if (url.hostname === "oauth2.googleapis.com" && url.pathname === "/token") {
      const form = new URLSearchParams(await request.text());
      assert.equal(form.get("grant_type"), "refresh_token");
      assert.equal(form.get("refresh_token"), "test-channel-refresh-token");
      if (this.channelUnavailable) return json({ error: "temporarily_unavailable" }, 503);
      this.refreshCount++;
      return json({ access_token: "test-channel-access-token", expires_in: 3600 });
    }
    if (url.hostname === "www.googleapis.com" || url.hostname === "youtubeanalytics.googleapis.com") {
      if (this.channelUnavailable) return json({ error: "temporarily_unavailable" }, 503);
      assert.equal(request.headers.get("authorization"), "Bearer test-channel-access-token");
      if (url.pathname === "/youtube/v3/channels") {
        this.channelChecks++;
        assert.equal(url.searchParams.get("mine"), "true");
        return json({ items: [{ id: channelId }] });
      }
      if (url.pathname === "/youtube/v3/liveBroadcasts") {
        if (method === "GET") {
          const id = url.searchParams.get("id");
          const items = id ? [this.broadcasts.get(id)].filter(Boolean) : [...this.broadcasts.values()];
          return json({ items });
        }
        const body = await request.json() as Json;
        if (method === "POST") {
          this.createCount++;
          const id = "abcdefghijk";
          const value = { id, etag: '"broadcast-1"', snippet: { ...body.snippet, channelId, categoryId: "27" }, status: { ...body.status, lifeCycleStatus: "created" }, contentDetails: body.contentDetails };
          assert.equal(body.contentDetails.enableAutoStart, false);
          assert.equal(body.contentDetails.enableAutoStop, false);
          this.broadcasts.set(id, value);
          return json(value);
        }
        if (method === "PUT") {
          const value = this.broadcasts.get(body.id)!;
          assert.equal(request.headers.get("if-match"), value.etag, "Updates must use Google's current ETag to avoid overwriting concurrent edits");
          this.updateCount++;
          this.lastUpdate = body;
          value.snippet = { ...body.snippet, channelId };
          value.etag = `"broadcast-${this.updateCount + 1}"`;
          return json(value);
        }
      }
      if (url.pathname === "/upload/youtube/v3/thumbnails/set") {
        this.thumbnailCount++;
        assert.equal(url.searchParams.get("videoId"), "abcdefghijk");
        assert.ok((await request.arrayBuffer()).byteLength > 8);
        return json({ items: [{ default: { url: "https://example.test/thumbnail.png" } }] });
      }
      if (url.hostname === "youtubeanalytics.googleapis.com" && url.pathname === "/v2/reports") {
        this.analyticsCount++;
        assert.equal(url.searchParams.get("ids"), `channel==${channelId}`);
        const dimensions = (url.searchParams.get("dimensions") ?? "").split(",").filter(Boolean);
        const metrics = url.searchParams.get("metrics")!.split(",");
        const values: Record<string, number> = { views: this.views, engagedViews: 100, estimatedMinutesWatched: 90, averageViewDuration: 54, averageViewPercentage: 40, likes: 7, comments: 3, shares: 2, subscribersGained: 5, subscribersLost: 1 };
        const dimensionValues: Record<string, string | number> = { day: url.searchParams.get("startDate")!, video: "abcdefghijk", insightTrafficSourceType: "YT_SEARCH", elapsedVideoTimeRatio: 0.01, livestreamPosition: 1 };
        return json({
          kind: "youtubeAnalytics#resultTable",
          columnHeaders: [...dimensions.map(name => ({ name, columnType: "DIMENSION", dataType: "STRING" })), ...metrics.map(name => ({ name, columnType: "METRIC", dataType: "FLOAT" }))],
          rows: [[...dimensions.map(name => dimensionValues[name]), ...metrics.map(name => values[name] ?? 1)]],
        });
      }
    }
    if (url.hostname === `${streamId}.k2.cloudflarestorage.com`) {
      assert.equal(request.headers.get("authorization"), "Bearer test-k2-consume-token");
      const body = await request.json() as Json;
      assert.ok(body.worker_id);
      if (url.pathname === `/subscriptions/${subscriptionId}/consume`) {
        if (!this.leased.length) this.leased = this.k2Records.splice(0, body.max_records);
        return json({ success: true, result: { batch_id: this.leased.length ? "d".repeat(32) : null, leased_until_ms: this.leased.length ? Date.now() + 300000 : null, records: this.leased } });
      }
      if (url.pathname.endsWith("/extend")) return json({ success: true, result: { leased_until_ms: Date.now() + 300000 } });
      if (url.pathname.endsWith("/ack")) {
        if (this.failNextAck) { this.failNextAck = false; return json({ success: false, errors: [{ code: 10211 }] }, 503); }
        this.leased = [];
        return json({ success: true, result: {} });
      }
      if (url.pathname.endsWith("/nack")) {
        this.k2Records.unshift(...this.leased);
        this.leased = [];
        return json({ success: true, result: {} });
      }
    }
    if (url.hostname === "api.sql.cloudflarestorage.com") {
      assert.equal(request.headers.get("authorization"), "Bearer test-basin-sql-token");
      assert.equal(url.pathname, `/api/v1/accounts/${accountId}/basin-sql/query/youtube-poc-warehouse`);
      const body = await request.json() as Json;
      assert.equal(body.warehouse, `${accountId}_youtube-poc-warehouse`);
      const queryKey = body.query.match(/query_key\s*=\s*'([a-f0-9]{64})'/)?.[1];
      assert.ok(queryKey, "Warehouse must use a validated exact report query key");
      assert.ok(body.query.includes(channelId), "Warehouse queries must be scoped to the configured channel");
      const rows = this.pipelineRecords.filter(row => row.query_key === queryKey).sort((a, b) => String(b.observed_at).localeCompare(String(a.observed_at)) || String(b.event_id).localeCompare(String(a.event_id))).slice(0, 1);
      return json({ success: true, result: { rows } });
    }
    // Any unexpected outbound destination is a hard test failure, never a real fetch.
    this.unexpected.push(`${method} ${url.origin}${url.pathname}`);
    return json({ error: "Unexpected mock request" }, 599);
  }
}

async function fixture(upstreams: Upstreams, overrides: Record<string, string> = {}, persistence?: string) {
  const options = convertV4MiniflareOptions({
    workers: [{
      name: "edge-proxy", modules: true, script: publicOriginProxy,
      compatibilityDate: "2026-10-31", serviceBindings: { APP: "youtube-control" },
      outboundService: (request: Request) => upstreams.fetch(request),
    }, {
      name: "youtube-control", modules: true,
      scriptPath: fileURLToPath(new URL("../dist/main.js", import.meta.url)),
      compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
      bindings: {
        YOUTUBE_CHANNEL_ID: channelId,
        YOUTUBE_CREDENTIALS_JSON: JSON.stringify({ client_id: "test-google-client", client_secret: "test-google-secret", refresh_token: "test-channel-refresh-token" }),
        READ_API_TOKEN: readToken, WRITE_API_TOKEN: writeToken,
        CLOUDFLARE_ACCOUNT_ID: accountId, BASIN_BUCKET_NAME: "youtube-poc-warehouse", K2_STREAM_ID: streamId, K2_SUBSCRIPTION_ID: subscriptionId,
        K2_CONSUME_TOKEN: "test-k2-consume-token", BASIN_SQL_TOKEN: "test-basin-sql-token",
        PUBLIC_ORIGIN: origin, MCP_OWNER_GOOGLE_SUB: "owner-sub", MCP_GOOGLE_CLIENT_ID: "test-mcp-client", MCP_GOOGLE_CLIENT_SECRET: "test-mcp-secret",
        ...overrides,
      },
      durableObjects: { CHANNELS: { className: "YouTubeChannel", useSQLite: true } },
      r2Buckets: ["ASSETS", "ANALYTICS_RAW"], kvNamespaces: ["OAUTH_KV"],
      serviceBindings: { ANALYTICS_EVENTS: { name: "mock-producers", entrypoint: "K2Producer" }, ANALYTICS_PIPELINE: { name: "mock-producers", entrypoint: "PipelineProducer" } },
      outboundService: (request: Request) => upstreams.fetch(request),
    }, {
      name: "mock-producers", modules: true,
      script: await readFile(new URL("fixtures/producers.mjs", import.meta.url), "utf8"),
      compatibilityDate: "2026-10-31", compatibilityFlags: ["nodejs_compat"],
      outboundService: (request: Request) => upstreams.fetch(request),
    }],
  });
  // Miniflare 5 uses one native persistence directory; its V4 adapter omits the
  // former per-resource persistence options.
  if (persistence) options.resourcePersistencePath = persistence;
  const mf = new Miniflare(options);
  try { await mf.ready; return mf; }
  catch (error) { await mf.dispose(); throw error; }
}

test("Worker runtime acceptance: publishing and stored analytics work together", { timeout: 60000 }, async t => {
  const googleLogin = await GoogleLoginMock.create();
  const upstreams = new Upstreams(googleLogin);
  const persistence = await mkdtemp(join(tmpdir(), "youtube-control-acceptance-"));
  let mf = await fixture(upstreams, {}, persistence);
  t.after(async () => { await mf.dispose(); await rm(persistence, { recursive: true, force: true }); assert.deepEqual(upstreams.unexpected, []); });
  const request = async (path: string, body?: unknown, token = readToken) => {
    const response = await mf.dispatchFetch(origin + path, { method: body === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Json };
  };
  const session = { sessionId: "acceptance-session", title: "Acceptance broadcast", description: "A safe local acceptance fixture", scheduledStartTime: new Date(Date.now() + 86400000).toISOString(), privacyStatus: "private", madeForKids: false };
  let planId = "";

  await t.test("planning is read-only and a read token cannot apply", async () => {
    const plan = await request("/v1/sessions/plan", session);
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    assert.deepEqual(plan.body.actions.map((action: Json) => action.kind), ["create"]);
    planId = plan.body.planId;
    assert.equal(upstreams.createCount, 0);
    const denied = await request("/v1/sessions/apply", { planId });
    assert.equal(denied.status, 403);
    assert.equal(upstreams.createCount, 0);
  });
  await t.test("apply creates once, replay returns the same result, and update preserves unrelated fields", async () => {
    const applied = await request("/v1/sessions/apply", { planId }, writeToken);
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.equal(applied.body.broadcastId, "abcdefghijk");
    assert.equal(upstreams.createCount, 1);
    const replayed = await request("/v1/sessions/apply", { planId }, writeToken);
    assert.deepEqual(replayed.body, applied.body);
    assert.equal(upstreams.createCount, 1);
    const update = await request("/v1/sessions/plan", { sessionId: session.sessionId, description: "Updated description" });
    assert.equal(update.status, 200, JSON.stringify(update.body));
    const changed = await request("/v1/sessions/apply", { planId: update.body.planId }, writeToken);
    assert.equal(changed.status, 200, JSON.stringify(changed.body));
    assert.equal(upstreams.updateCount, 1);
    assert.equal(upstreams.lastUpdate?.snippet.categoryId, "27");
    assert.equal(upstreams.lastUpdate?.snippet.title, session.title);
    assert.equal(upstreams.lastUpdate?.snippet.scheduledStartTime, session.scheduledStartTime);
    const found = await request("/v1/broadcasts/abcdefghijk");
    assert.equal(found.body.description, "Updated description");
    assert.equal(found.body.privacyStatus, "private");
  });
  await t.test("thumbnail upload flows through private R2 and reviewed content hash", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1cAAAAASUVORK5CYII=", "base64");
    const uploaded = await mf.dispatchFetch(origin + "/v1/thumbnails", { method: "POST", headers: { authorization: `Bearer ${writeToken}`, "content-type": "image/png" }, body: png });
    assert.equal(uploaded.status, 201);
    const asset = await uploaded.json() as Json;
    const bucket = await mf.getR2Bucket("ASSETS", "youtube-control");
    assert.ok(await bucket.head(`thumbnails/${asset.sha256}`));
    const plan = await request("/v1/sessions/plan", { sessionId: session.sessionId, thumbnailSha256: asset.sha256 });
    assert.equal(plan.status, 200, JSON.stringify(plan.body));
    assert.deepEqual(plan.body.actions.map((action: Json) => action.kind), ["thumbnail"]);
    const applied = await request("/v1/sessions/apply", { planId: plan.body.planId }, writeToken);
    assert.equal(applied.status, 200, JSON.stringify(applied.body));
    assert.equal(upstreams.thumbnailCount, 1);
  });
  const query = { report: "daily", startDate: "2026-10-01", endDate: "2026-10-03" };
  await t.test("Google reports are archived, streamed through K2 and Pipelines, and queried from Basin", async () => {
    upstreams.failNextProduce = true;
    const collected = await request("/v1/analytics/query", { ...query, refresh: true });
    assert.equal(collected.status, 200, JSON.stringify(collected.body));
    assert.equal(collected.body.rows[0].views, 123);
    assert.equal(collected.body.servedFrom, "youtube");
    assert.equal(collected.body.storage.stage, "queued_for_k2", "K2 rejection must retain the report in the outbox");
    assert.equal(collected.body.storage.warehouseVisible, false);
    assert.equal(collected.body.dataThrough, "2026-10-01");
    assert.deepEqual(collected.body.absentDays, ["2026-10-02", "2026-10-03"]);
    assert.equal(collected.body.requestedRange.timeZone, "America/Los_Angeles");
    const raw = await mf.getR2Bucket("ANALYTICS_RAW", "youtube-control");
    assert.equal((await raw.list()).objects.length, 1);
    assert.equal((await request("/v1/status")).body.outbox.pending, 1);
    // Restart the runtime against the same on-disk DO/R2/KV state. This proves
    // recovery without retaining any publishing locks or outbox state in memory.
    await mf.dispose();
    mf = await fixture(upstreams, {}, persistence);
    assert.equal((await request("/v1/status")).body.outbox.pending, 1, "Restart must reload the persisted outbox before delivery");
    const drained = await request("/v1/analytics/drain", {}, writeToken).catch(error => {
      assert.fail(JSON.stringify({ error: String(error), outboundRequests: upstreams.calls }));
    });
    assert.equal(drained.status, 200, JSON.stringify(drained.body));
    assert.equal(upstreams.pipelineRecords.length, 1, JSON.stringify(drained.body));
    assert.equal((await request("/v1/status")).body.outbox.pending, 0, "The persisted outbox must survive runtime restart and drain successfully");
    assert.equal(upstreams.leased.length, 0, "K2 lease must be acknowledged after Pipeline accepts the snapshot");
    const count = upstreams.analyticsCount;
    upstreams.channelUnavailable = true;
    const stored = await request("/v1/analytics/query", query);
    upstreams.channelUnavailable = false;
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
    assert.equal(stored.body.rows[0].views, 123);
    assert.equal(stored.body.servedFrom, "basin");
    assert.equal(stored.body.storage.warehouseVisible, true);
    assert.equal(upstreams.analyticsCount, count, "Stored reads must work from Basin even while Google is unavailable");
    assert.ok(upstreams.refreshCount >= 1 && upstreams.channelChecks >= 1, "Both paths must use the configured Google authorization");
  });
  await t.test("K2 replay cannot double-count a snapshot and a refreshed report replaces its older values", async () => {
    const event = upstreams.pipelineRecords[0];
    const replay = await request("/v1/analytics/replay", { snapshotId: event.event_id }, writeToken);
    assert.equal(replay.status, 200, JSON.stringify(replay.body));
    upstreams.failNextAck = true;
    const ackLost = await request("/v1/analytics/drain", {}, writeToken);
    assert.equal(ackLost.status, 502, "A lost K2 acknowledgement must be visible and retryable");
    const redelivered = await request("/v1/analytics/drain", {}, writeToken);
    assert.equal(redelivered.status, 200, JSON.stringify(redelivered.body));
    assert.ok(upstreams.pipelineRecords.filter(row => row.event_id === event.event_id).length >= 2);
    const unchanged = await request("/v1/analytics/query", query);
    assert.equal(unchanged.body.rows.length, 1);
    assert.equal(unchanged.body.rows[0].views, 123);
    upstreams.views = 150;
    const refreshed = await request("/v1/analytics/query", { ...query, refresh: true });
    assert.equal(refreshed.status, 200, JSON.stringify(refreshed.body));
    await request("/v1/analytics/drain", {}, writeToken);
    const corrected = await request("/v1/analytics/query", query);
    assert.equal(corrected.body.rows[0].views, 150);
    assert.equal(corrected.body.rows.length, 1, "A new observation replaces the old report; observations are not summed");
  });
  await t.test("protected routes reject missing credentials and MCP rejects script bearer tokens", async () => {
    const missing = await mf.dispatchFetch(origin + "/v1/status");
    assert.equal(missing.status, 401);
    const unknown = await request("/v1/unknown");
    assert.equal(unknown.status, 404);
    const crossOrigin = await mf.dispatchFetch(origin + "/v1/status", { headers: { authorization: `Bearer ${readToken}`, origin: "https://evil.example" } });
    assert.equal(crossOrigin.status, 403);
    const mcp = await mf.dispatchFetch(origin + "/mcp", { method: "POST", headers: { authorization: `Bearer ${writeToken}`, "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }) });
    assert.equal(mcp.status, 401, "MCP must use its OAuth authorization, not a script token");
    const metadataURL = mcp.headers.get("www-authenticate")?.match(/resource_metadata="([^"]+)"/)?.[1];
    assert.ok(metadataURL, "MCP must advertise its protected-resource discovery URL");
    assert.equal(new URL(metadataURL).origin, origin);
    const metadata = await mf.dispatchFetch(metadataURL);
    assert.equal(metadata.status, 200);
    const protectedResource = await metadata.json() as Json;
    assert.ok(protectedResource.authorization_servers?.includes(origin));
  });
  await t.test("ChatGPT-style OAuth MCP clients can query analytics and explicitly publish a reviewed plan", async () => {
    const reader = await authorizedMcp(mf, googleLogin);
    const toolList = await mcpRequest(mf, reader.access_token, "tools/list");
    assert.equal(toolList.status, 200, await toolList.clone().text());
    const readTools = (await readMcp(toolList)).result.tools.map((tool: Json) => tool.name);
    assert.ok(readTools.includes("get_analytics"));
    assert.ok(!readTools.includes("apply_session"), "A read-only OAuth grant must not expose publishing");
    const analyticsResponse = await mcpRequest(mf, reader.access_token, "tools/call", { name: "get_analytics", arguments: query });
    assert.equal(analyticsResponse.status, 200, await analyticsResponse.clone().text());
    const analyticsRPC = await readMcp(analyticsResponse);
    assert.ok(!analyticsRPC.result.isError, JSON.stringify(analyticsRPC));
    const analytics = JSON.parse(analyticsRPC.result.content[0].text);
    assert.equal(analytics.servedFrom, "basin");
    assert.equal(analytics.rows[0].views, 150);

    const writer = await authorizedMcp(mf, googleLogin, true);
    const planResponse = await mcpRequest(mf, writer.access_token, "tools/call", { name: "plan_session", arguments: { sessionId: session.sessionId, title: "Reviewed through MCP" } });
    assert.equal(planResponse.status, 200, await planResponse.clone().text());
    const plannedRPC = await readMcp(planResponse);
    assert.ok(!plannedRPC.result.isError, JSON.stringify(plannedRPC));
    const planned = JSON.parse(plannedRPC.result.content[0].text);
    const before = upstreams.updateCount;
    assert.equal(upstreams.broadcasts.get("abcdefghijk")?.snippet.title, session.title, "MCP planning must not publish");
    const appliedResponse = await mcpRequest(mf, writer.access_token, "tools/call", { name: "apply_session", arguments: { planId: planned.planId } });
    assert.equal(appliedResponse.status, 200, await appliedResponse.clone().text());
    const appliedRPC = await readMcp(appliedResponse);
    assert.ok(!appliedRPC.result.isError, JSON.stringify(appliedRPC));
    assert.equal(JSON.parse(appliedRPC.result.content[0].text).title, "Reviewed through MCP");
    assert.equal(upstreams.updateCount, before + 1);
    assert.equal(upstreams.createCount, 1);
  });
});

test("Worker fails closed when owner API credentials are not configured", { timeout: 30000 }, async t => {
  const upstreams = new Upstreams();
  const mf = await fixture(upstreams, { READ_API_TOKEN: "", WRITE_API_TOKEN: "" });
  t.after(() => mf.dispose());
  const health = await mf.dispatchFetch(origin + "/health");
  assert.equal(health.status, 200);
  const protectedResponse = await mf.dispatchFetch(origin + "/v1/status", { headers: { authorization: `Bearer ${writeToken}` } });
  assert.equal(protectedResponse.status, 503);
  assert.equal(upstreams.calls.length, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { errorBody, readLimited, ServiceError, sessionSchema } from "../src/domain.ts";
import { GoogleClient } from "../src/google.ts";

const channelId = `UC${"a".repeat(22)}`;
const credentials = JSON.stringify({ client_id: "client", client_secret: "secret", refresh_token: "refresh", channel_id: channelId });
const fails = (code: string) => (error: unknown) => error instanceof ServiceError && error.code === code;
const json = (body: unknown, status = 200) => Response.json(body, { status });

test("API writes are not retried and upstream secret-bearing bodies do not escape", async () => {
  let writes = 0;
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => {
    if (String(input).includes("oauth2.googleapis.com")) return json({ access_token: "access" });
    writes++;
    return json({ message: "refresh=DO_NOT_PRINT client_secret=DO_NOT_PRINT" }, 503);
  }) as typeof fetch);
  try { await api.request("POST", "liveBroadcasts", {}, { title: "secret title" }); assert.fail("Expected failure"); }
  catch (error) {
    assert.equal(errorBody(error).error, "google_api_error");
    assert.doesNotMatch(JSON.stringify(errorBody(error)), /DO_NOT_PRINT|secret title/);
  }
  assert.equal(writes, 1);
});

test("only bounded, well-formed Google rejection envelopes are definitive", async () => {
  const envelope = (status: number) => ({ error: { code: status, message: "DO_NOT_EXPOSE", errors: [{ reason: "liveStreamingNotEnabled" }] } });
  const cases = [
    ...[400, 401, 403, 404].map(status => ({ status, body: JSON.stringify(envelope(status)), definitive: true })),
    ...[408, 409, 429, 500, 503].map(status => ({ status, body: JSON.stringify(envelope(status)), definitive: false })),
    { status: 403, body: "malformed", definitive: false },
    { status: 403, body: JSON.stringify(envelope(400)), definitive: false },
    { status: 403, body: JSON.stringify({ error: { code: 403 } }), definitive: false },
    { status: 403, body: JSON.stringify({ ...envelope(403), padding: "x".repeat(65536) }), definitive: false },
  ];
  for (const item of cases) {
    const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => String(input).includes("oauth2.googleapis.com") ? json({ access_token: "access" }) : new Response(item.body, { status: item.status, headers: { "content-type": "application/json" } })) as typeof fetch);
    await assert.rejects(api.request("POST", "liveBroadcasts", {}, {}), error => {
      assert.ok(error instanceof ServiceError);
      assert.equal(error.upstreamStatus, item.status);
      assert.equal(error.definitiveRejection, item.definitive);
      const safeError = errorBody(error);
      assert.ok("upstreamStatus" in safeError);
      assert.equal(safeError.upstreamStatus, item.status);
      assert.doesNotMatch(JSON.stringify(safeError), /DO_NOT_EXPOSE|liveStreamingNotEnabled/);
      return true;
    });
  }
});

test("conditional update preserves Google ETag and surfaces conflicts as stale plans", async () => {
  let actualHeader: string | null = null;
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("oauth2.googleapis.com")) return json({ access_token: "access" });
    actualHeader = new Headers(init?.headers).get("if-match");
    return json({}, 412);
  }) as typeof fetch);
  await assert.rejects(api.request("PUT", "liveBroadcasts", { part: "snippet" }, { id: "AAAAAAAAAAA" }, { ifMatch: '"etag-1"' }), fails("stale_plan"));
  assert.equal(actualHeader, '"etag-1"');
});

test("analytics always uses the configured channel, regardless of query input", async () => {
  let actualIds: string | null = null;
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => {
    if (String(input).includes("oauth2.googleapis.com")) return json({ access_token: "access" });
    actualIds = new URL(String(input)).searchParams.get("ids");
    return json({});
  }) as typeof fetch);
  await api.analytics({ ids: "channel==someone-else", metrics: "views" });
  assert.equal(actualIds, `channel==${channelId}`);
});

test("OAuth credentials pinned to another channel fail before any network request", async () => {
  let requests = 0;
  const api = new GoogleClient(credentials, `UC${"b".repeat(22)}`, (async () => { requests++; return json({}); }) as typeof fetch);
  await assert.rejects(api.checkChannel(), fails("wrong_channel"));
  assert.equal(requests, 0);
});

test("an ambiguous owned-channel list cannot authorize creation on a possibly different default channel", async () => {
  for (const response of [
    { items: [{ id: channelId }, { id: `UC${"b".repeat(22)}` }] },
    { items: [{ id: channelId }], nextPageToken: "more-channels" },
  ]) {
    const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => String(input).includes("oauth2.googleapis.com") ? json({ access_token: "access" }) : json(response)) as typeof fetch);
    await assert.rejects(api.checkChannel(), fails("wrong_channel"));
  }
});

test("a grant identifying only the configured YouTube channel is accepted", async () => {
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => String(input).includes("oauth2.googleapis.com") ? json({ access_token: "access" }) : json({ items: [{ id: channelId }] })) as typeof fetch);
  await api.checkChannel();
});

test("API resources cannot redirect credentials to another service", async () => {
  let requests = 0;
  const api = new GoogleClient(credentials, channelId, (async () => { requests++; return json({}); }) as typeof fetch);
  await assert.rejects(api.request("GET", "https://attacker.invalid/"), fails("invalid_resource"));
  await assert.rejects(api.request("GET", "../another-api"), fails("invalid_resource"));
  assert.equal(requests, 0);
});

test("OAuth and API redirects are handled manually and cannot forward credentials to another host", async () => {
  for (const redirectStage of ["oauth", "api"]) {
    const hosts: string[] = [];
    const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input)); hosts.push(url.hostname);
      assert.equal(init?.redirect, "manual");
      assert.ok(["oauth2.googleapis.com", "www.googleapis.com"].includes(url.hostname));
      if (url.hostname === "oauth2.googleapis.com" && redirectStage !== "oauth") return json({ access_token: "access" });
      return new Response(null, { status: 307, headers: { location: "https://attacker.invalid/collect" } });
    }) as typeof fetch);
    await assert.rejects(api.request("POST", "liveBroadcasts", {}, { title: "Session" }), fails("google_api_error"));
    assert.deepEqual(hosts, redirectStage === "oauth" ? ["oauth2.googleapis.com"] : ["oauth2.googleapis.com", "www.googleapis.com"]);
  }
});

test("broadcast discovery paginates and never combines mutually exclusive filters", async () => {
  const urls: URL[] = [];
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => {
    if (String(input).includes("oauth2.googleapis.com")) return json({ access_token: "access" });
    const url = new URL(String(input)); urls.push(url);
    return json(url.searchParams.has("pageToken") ? { items: [] } : { items: [], nextPageToken: "second" });
  }) as typeof fetch);
  assert.deepEqual(await api.broadcasts(), []);
  assert.equal(urls.length, 2);
  assert.equal(urls[0].searchParams.get("broadcastStatus"), "upcoming");
  assert.equal(urls[0].searchParams.has("mine"), false);
  assert.equal(urls[1].searchParams.get("pageToken"), "second");
});

test("incomplete discovery fails closed after its bounded page budget", async () => {
  let pages = 0;
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => {
    if (String(input).includes("oauth2.googleapis.com")) return json({ access_token: "access" });
    pages++;
    return json({ items: [], nextPageToken: `page-${pages}` });
  }) as typeof fetch);
  await assert.rejects(api.broadcasts(), fails("discovery_limit"));
  assert.equal(pages, 20);
});

test("stream checks request no ingestion address or stream key fields", async () => {
  let fields: string | null = null;
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => {
    if (String(input).includes("oauth2.googleapis.com")) return json({ access_token: "access" });
    fields = new URL(String(input)).searchParams.get("fields");
    return json({ items: [{ id: "encoder", snippet: { channelId }, status: { streamStatus: "inactive" } }] });
  }) as typeof fetch);
  await api.checkStream("encoder");
  assert.equal(fields, "items(id,snippet/channelId,status/streamStatus)");
});

test("date validation rejects overflow, ambiguous timezone, unknown fields and oversized UTF-8 copy", () => {
  const base = { sessionId: "session" };
  for (const value of ["2026-02-30T17:00:00Z", "2026-11-11T17:00:00", "2026-11-11T25:00:00Z"]) assert.equal(sessionSchema.safeParse({ ...base, scheduledStartTime: value }).success, false);
  assert.equal(sessionSchema.safeParse({ ...base, description: "🪄".repeat(1251) }).success, false);
  assert.equal(sessionSchema.safeParse({ ...base, channelId: "other" }).success, false);
  assert.equal(sessionSchema.parse({ ...base, scheduledStartTime: "2026-11-11T18:00:00+01:00" }).scheduledStartTime, "2026-11-11T17:00:00.000Z");
});

test("body limits cancel oversized streams instead of buffering them without a bound", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(4)); controller.enqueue(new Uint8Array(4)); }, cancel() { cancelled = true; } });
  await assert.rejects(readLimited(body, 5), fails("payload_too_large"));
  assert.equal(cancelled, true);
});

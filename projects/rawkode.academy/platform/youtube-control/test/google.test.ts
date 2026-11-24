import assert from "node:assert/strict";
import test from "node:test";
import { errorBody, ServiceError } from "../src/domain.ts";
import { GoogleClient } from "../src/google.ts";

const channelId = `UC${"a".repeat(22)}`;
const credentials = { clientId: "client", clientSecret: "secret", refreshToken: "refresh" };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const isTokenEndpoint = (input: RequestInfo | URL) => new URL(String(input)).hostname === "oauth2.googleapis.com";

test("analytics requests are scoped to the configured channel with a refreshed token", async () => {
  const seen: URL[] = [];
  let refreshes = 0;
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isTokenEndpoint(input)) { refreshes++; return json({ access_token: "access" }); }
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer access");
    seen.push(new URL(String(input)));
    return json({ columnHeaders: [], rows: [] });
  }) as typeof fetch);
  await api.analytics({ metrics: "views", startDate: "2026-01-01", endDate: "2026-01-02", filters: undefined });
  await api.analytics({ metrics: "views", startDate: "2026-01-01", endDate: "2026-01-02" });
  assert.equal(refreshes, 1);
  assert.equal(seen[0].hostname, "youtubeanalytics.googleapis.com");
  assert.equal(seen[0].searchParams.get("ids"), `channel==${channelId}`);
  assert.equal(seen[0].searchParams.has("filters"), false);
});

test("upstream error bodies never escape", async () => {
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => isTokenEndpoint(input) ? json({ access_token: "access" }) : json({ message: "refresh=DO_NOT_PRINT" }, 503)) as typeof fetch);
  await assert.rejects(api.analytics({ metrics: "views" }), error => {
    assert.equal(errorBody(error).error, "google_api_error");
    assert.doesNotMatch(JSON.stringify(errorBody(error)), /DO_NOT_PRINT/);
    return true;
  });
});

test("missing credentials are refused before calling Google", async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return json({}); }) as typeof fetch;
  for (const value of [{}, { clientId: "c" }, { clientId: "c", clientSecret: "s", refreshToken: "" }]) {
    await assert.rejects(new GoogleClient(value, channelId, fetcher).analytics({}), (error: unknown) => error instanceof ServiceError && error.code === "reauthorization_required");
  }
  assert.equal(calls, 0);
});

test("a revoked grant says to re-run consent, naming only Google's error code", async () => {
  const api = new GoogleClient(credentials, channelId, (async () => json({ error: "invalid_grant", error_description: "Token has been expired or revoked. refresh=DO_NOT_PRINT" }, 400)) as typeof fetch);
  await assert.rejects(api.analytics({}), (error: unknown) => {
    assert.ok(error instanceof ServiceError);
    assert.equal(error.code, "reauthorization_required");
    assert.match(error.message, /invalid_grant/);
    assert.match(error.message, /cuenv task consent/);
    assert.doesNotMatch(error.message, /DO_NOT_PRINT/);
    return true;
  });
});

test("the grant must identify exactly the configured channel", async () => {
  const channels = (items: { id: string }[], nextPageToken?: string) => new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => isTokenEndpoint(input) ? json({ access_token: "access" }) : json({ items, nextPageToken })) as typeof fetch);
  await channels([{ id: channelId }]).checkChannel();
  await assert.rejects(channels([{ id: "UCother" }]).checkChannel(), (error: unknown) => error instanceof ServiceError && error.code === "wrong_channel");
  await assert.rejects(channels([{ id: channelId }, { id: "UCother" }]).checkChannel());
  await assert.rejects(channels([{ id: channelId }], "more").checkChannel());
});

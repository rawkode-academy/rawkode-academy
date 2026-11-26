import assert from "node:assert/strict";
import test from "node:test";
import { errorBody } from "../src/domain.ts";
import { GoogleClient } from "../src/google.ts";

const channelId = `UC${"a".repeat(22)}`;
const credentials = { clientId: "client", clientSecret: "secret", refreshToken: "refresh" };
const json = (body: unknown, status = 200) => Response.json(body, { status });
const isToken = (input: RequestInfo | URL) => new URL(String(input)).hostname === "oauth2.googleapis.com";

test("videos.update sends the complete snippet with PUT and a refreshed token", async () => {
  const seen: { url: URL; method?: string; body: unknown; auth: string | null }[] = [];
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (isToken(input)) return json({ access_token: "access" });
    seen.push({ url: new URL(String(input)), method: init?.method, body: JSON.parse(String(init?.body)), auth: new Headers(init?.headers).get("authorization") });
    return json({ id: "abcdefghijk" });
  }) as typeof fetch);
  const snippet = { title: "T", description: "D", categoryId: "28", tags: ["k8s"], defaultLanguage: "en" };
  await api.updateSnippet("abcdefghijk", snippet);
  assert.equal(seen[0].method, "PUT");
  assert.equal(seen[0].url.pathname, "/youtube/v3/videos");
  assert.equal(seen[0].url.searchParams.get("part"), "snippet");
  assert.equal(seen[0].auth, "Bearer access");
  assert.deepEqual(seen[0].body, { id: "abcdefghijk", snippet });
});

test("a partial snippet is refused before any request", async () => {
  let calls = 0;
  const api = new GoogleClient(credentials, channelId, (async () => { calls++; return json({}); }) as typeof fetch);
  await assert.rejects(api.updateSnippet("abcdefghijk", { title: "T", description: "D", categoryId: "" }));
  assert.equal(calls, 0);
});

test("listSnippets keeps only writable fields and omits videos YouTube does not return", async () => {
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => isToken(input) ? json({ access_token: "a" }) : json({ items: [{ id: "abcdefghijk", snippet: { title: "T", description: "D", categoryId: "28", publishedAt: "x", channelId: "y" } }] })) as typeof fetch);
  const map = await api.listSnippets(["abcdefghijk", "bcdefghijkl"]);
  assert.deepEqual([...map.keys()], ["abcdefghijk"]);
  assert.deepEqual(map.get("abcdefghijk"), { title: "T", description: "D", categoryId: "28" });
});

test("upstream error bodies never escape and a 403 keeps its status", async () => {
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => isToken(input) ? json({ access_token: "a" }) : json({ error: "refresh=DO_NOT_PRINT" }, 403)) as typeof fetch);
  await assert.rejects(api.updateSnippet("abcdefghijk", { title: "T", description: "D", categoryId: "28" }), error => {
    assert.equal((error as { upstreamStatus?: number }).upstreamStatus, 403);
    assert.doesNotMatch(JSON.stringify(errorBody(error)), /DO_NOT_PRINT/);
    return true;
  });
});

test("a grant for a different channel is refused", async () => {
  const api = new GoogleClient(credentials, channelId, (async (input: RequestInfo | URL) => isToken(input) ? json({ access_token: "a" }) : json({ items: [{ id: "UCother" }] })) as typeof fetch);
  await assert.rejects(api.checkChannel(), error => errorBody(error).error === "wrong_channel");
});

test("missing credentials point at the consent task", async () => {
  const api = new GoogleClient({}, channelId, (async () => json({})) as typeof fetch);
  await assert.rejects(api.listSnippets(["abcdefghijk"]), error => { assert.match(errorBody(error).message, /cuenv task consent/); return true; });
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { findDrift, lakeTotals } from "../src/reconcile.ts";
import { GoogleClient } from "../src/google.ts";
import { ServiceError } from "../src/domain.ts";

const lake = new Map([["aaaaaaaaaaa", 1000], ["bbbbbbbbbbb", 250], ["ccccccccccc", 40]]);

test("a video the lake undercounts beyond the tolerance drifts; small gaps and lake lag do not", () => {
  const youtube = new Map([["aaaaaaaaaaa", 1040], ["bbbbbbbbbbb", 1250], ["ccccccccccc", 60], ["ddddddddddd", 900]]);
  assert.deepEqual(findDrift(["aaaaaaaaaaa", "bbbbbbbbbbb", "ccccccccccc", "ddddddddddd", "eeeeeeeeeee"], lake, youtube), [
    { videoId: "bbbbbbbbbbb", lake: 250, youtube: 1250 },
    // never seen by the lake: a new or newly mapped video
    { videoId: "ddddddddddd", lake: 0, youtube: 900 },
  ]);
});

test("a video YouTube does not report is skipped, and the lake counting more is not drift", () => {
  assert.deepEqual(findDrift(["aaaaaaaaaaa", "zzzzzzzzzzz"], lake, new Map([["aaaaaaaaaaa", 10]])), []);
});

test("the lake query's rows become per-video totals, as objects or as arrays with a schema", async () => {
  const answer = (body: unknown, status = 200) => async () => Response.json(body, { status });
  const basin = { accountId: "acct", bucket: "bucket", token: "t" };
  const asObjects = await lakeTotals(basin, answer({ success: true, result: { rows: [{ video: "aaaaaaaaaaa", views: 5 }] } }) as typeof fetch);
  assert.deepEqual([...asObjects], [["aaaaaaaaaaa", 5]]);
  const asArrays = await lakeTotals(basin, answer({ result: { schema: [{ name: "video" }, { name: "views" }], rows: [["bbbbbbbbbbb", 7]] } }) as typeof fetch);
  assert.deepEqual([...asArrays], [["bbbbbbbbbbb", 7]]);
  await assert.rejects(lakeTotals(basin, answer({}, 401) as typeof fetch), (error: unknown) => error instanceof ServiceError && error.code === "basin_error");
});

test("public view counts are read 50 videos to a call", async () => {
  const calls: string[] = [];
  const fetcher = (async (input: URL | string) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "x" });
    calls.push(url.searchParams.get("id")!);
    return Response.json({ items: url.searchParams.get("id")!.split(",").map(id => ({ id, statistics: { viewCount: "12" } })) });
  }) as typeof fetch;
  const google = new GoogleClient({ clientId: "a", clientSecret: "b", refreshToken: "c" }, "chan", fetcher);
  const ids = Array.from({ length: 120 }, (_, n) => `v${String(n).padStart(10, "0")}`);
  const counts = await google.videoViewCounts(ids);
  assert.equal(counts.size, 120);
  assert.deepEqual(calls.map(call => call.split(",").length), [50, 50, 20]);
  assert.equal(counts.get(ids[0]!), 12);
});

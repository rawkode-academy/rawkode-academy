import test from "node:test";
import assert from "node:assert/strict";
import { basinQuery, MAX_ROWS, parseRows, readOnlyStatement } from "../src/basin.ts";
import { youtubeDailySql, youtubeTrafficSql } from "../src/tools/analytics.ts";

test("readOnlyStatement accepts one SELECT or WITH statement only", () => {
  assert.equal(readOnlyStatement("  select 1;  "), "select 1");
  assert.equal(readOnlyStatement("WITH x AS (SELECT 1) SELECT * FROM x"), "WITH x AS (SELECT 1) SELECT * FROM x");
  for (const sql of ["", "DROP TABLE t", "SELECT 1; SELECT 2", "INSERT INTO t SELECT 1", "selected", "x".repeat(20001)]) {
    assert.throws(() => readOnlyStatement(sql), { code: "invalid_query" }, sql.slice(0, 40));
  }
});

test("parseRows reads row objects and schema-zipped arrays", () => {
  assert.deepEqual(parseRows({ result: { rows: [{ a: 1 }] } }), [{ a: 1 }]);
  assert.deepEqual(parseRows({ result: { schema: [{ name: "a" }, "b"], rows: [[1, "x"]] } }), [{ a: 1, b: "x" }]);
  assert.deepEqual(parseRows({ rows: [[1, 2]], schema: ["a"] }), [{ a: 1, col1: 2 }]);
  assert.deepEqual(parseRows({ success: true }), []);
});

test("basinQuery posts the query with the token, caps rows and surfaces Basin errors", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => ({ i }));
  const ok = { accountId: "a".repeat(32), bucket: "lake", token: "t", fetcher: (async (url: string, init: RequestInit) => { seen = { url, init }; return Response.json({ success: true, result: { rows } }); }) as typeof fetch };
  const result = await basinQuery(ok, "SELECT 1");
  assert.equal(seen!.url, `https://api.sql.cloudflarestorage.com/api/v1/accounts/${"a".repeat(32)}/basin-sql/query/lake`);
  assert.equal((seen!.init.headers as Record<string, string>).authorization, "Bearer t");
  assert.deepEqual(JSON.parse(seen!.init.body as string), { query: "SELECT 1" });
  assert.equal(result.rows.length, MAX_ROWS);
  assert.equal(result.rowCount, MAX_ROWS + 1);
  assert.equal(result.truncated, true);

  const failing = { ...ok, fetcher: (async () => Response.json({ success: false, errors: [{ message: "bad column" }] }, { status: 400 })) as typeof fetch };
  await assert.rejects(basinQuery(failing, "SELECT x"), { code: "basin_query_failed", message: "bad column", status: 400 });
  const down = { ...ok, fetcher: (async () => new Response("oops", { status: 503 })) as typeof fetch };
  await assert.rejects(basinQuery(down, "SELECT x"), { code: "basin_query_failed", status: 502 });
});

test("YouTube SQL keeps the latest fetch per day and stays within the date range", () => {
  const daily = youtubeDailySql("2026-01-01", "2026-01-31");
  assert.match(daily, /event_type = 'youtube\.daily'/);
  assert.match(daily, /PARTITION BY json_get_str\(value, 'data', 'day'\) ORDER BY json_get_str\(value, 'data', 'fetchedAt'\) DESC/);
  assert.match(daily, /BETWEEN '2026-01-01' AND '2026-01-31'/);
  const traffic = youtubeTrafficSql("2026-01-01", "2026-01-31");
  assert.match(traffic, /event_type = 'youtube\.daily_traffic'/);
  assert.match(traffic, /'insightTrafficSourceType'\)\s+ORDER BY/);
  assert.ok(readOnlyStatement(daily) && readOnlyStatement(traffic));
});

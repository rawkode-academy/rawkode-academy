import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL as NodeURL } from "node:url";
import test from "node:test";
import { analyticsSchema, fetchReportSnapshot, normalizeReport, type GoogleReport } from "../src/analytics.ts";
import { hash } from "../src/domain.ts";
import { pipelineRecordSchema, queryKey, Warehouse, type PipelineRecord, type SnapshotPointer, type WarehousePorts } from "../src/warehouse.ts";

const channelId = "UCrber_mFvp_FEF7D9u8PDEA";
const query = analyticsSchema.parse({ report: "daily", startDate: "2026-10-01", endDate: "2026-10-03" });
const columnNames = "day,views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,subscribersLost".split(",");
function raw(views = 12): GoogleReport {
  return { columnHeaders: columnNames.map((name, i) => ({ name, columnType: i === 0 ? "DIMENSION" : "METRIC", dataType: i === 0 ? "STRING" : "INTEGER" })), rows: [["2026-10-01", views, 10, 22, 110, 70, 3, 1, 1, 2, 0]] };
}
const observedAt = "2026-10-04T08:00:00.000Z";
function harness() {
  const objects = new Map<string, string>();
  const published: SnapshotPointer[] = [];
  const ingested: PipelineRecord[] = [];
  const visible: PipelineRecord[] = [];
  const events: string[] = [];
  let failProduce = false;
  let failPipeline = false;
  let leaseUntil = Date.parse(observedAt) + 300000;
  let errorHTTP = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body));
    assert.equal(init?.redirect, "manual");
    if (errorHTTP) return new Response("SECRET-UPSTREAM-RESPONSE", { status: errorHTTP });
    let result: unknown;
    if (url.endsWith("/consume")) {
      assert.deepEqual(body, { worker_id: `youtube-${channelId}`, max_records: 10 });
      events.push("consume");
      result = published.length ? { batch_id: "c".repeat(32), leased_until_ms: leaseUntil, records: published.map(p => ({ content: Buffer.from(JSON.stringify(p)).toString("base64") })) } : { batch_id: null, leased_until_ms: null, records: [] };
    } else if (url.endsWith("/ack")) {
      events.push("ack"); published.splice(0); result = {};
    } else if (url.endsWith("/nack")) {
      events.push("nack"); result = {};
    } else if (url.endsWith("/extend")) {
      events.push("extend"); result = { leased_until_ms: Date.parse(observedAt) + 300000 };
    } else {
      assert.equal(url, `https://api.sql.cloudflarestorage.com/api/v1/accounts/${"a".repeat(32)}/basin-sql/query/youtube-poc-basin`);
      assert.equal(body.warehouse, `${"a".repeat(32)}_youtube-poc-basin`);
      assert.match(body.query, /ORDER BY observed_at DESC, event_id DESC LIMIT 1$/);
      const key = body.query.match(/query_key = '([a-f0-9]{64})'/)?.[1];
      result = { rows: visible.filter(row => row.query_key === key && row.channel_id === channelId).sort((a, b) => b.observed_at.localeCompare(a.observed_at) || b.event_id.localeCompare(a.event_id)).slice(0, 1) };
    }
    return Response.json({ success: true, result });
  };
  const ports: WarehousePorts = {
    raw: {
      async put(key: string, value: string) { objects.set(key, value); return {}; },
      async get(key: string) { const value = objects.get(key); return value === undefined ? null : { body: new Response(value).body }; },
    } as unknown as WarehousePorts["raw"],
    events: { async send(records) {
      if (failProduce) return { success: false, error: { code: 10212, retryable: false } };
      for (const record of records) {
        assert.equal(record.headers?.["event-type"], "youtube.analytics.snapshot.v1");
        published.push(JSON.parse(new TextDecoder().decode(record.content)));
      }
      return { success: true };
    } },
    pipeline: { async send(records) {
      events.push("pipeline");
      if (failPipeline) throw new Error("Simulated sink outage");
      ingested.push(...records.map(r => pipelineRecordSchema.parse(r)));
    } },
    fetcher,
    now: () => Date.parse(observedAt),
  };
  const warehouse = new Warehouse(ports, { channelId, accountId: "a".repeat(32), bucketName: "youtube-poc-basin", streamId: "b".repeat(32), subscriptionId: "d".repeat(32), consumeToken: "test-k2-token", sqlToken: "test-sql-token" });
  return { warehouse, objects, published, ingested, visible, events, makeVisible: () => visible.push(...ingested.splice(0)), failProduce: () => { failProduce = true; }, failPipeline: (value: boolean) => { failPipeline = value; }, shortLease: () => { leaseUntil = Date.parse(observedAt) + 1000; }, errorHTTP: (code: number) => { errorHTTP = code; } };
}

test("query identity ignores refresh and irrelevant limits but preserves top-video limits", async () => {
  assert.equal(await queryKey(query, channelId), await queryKey({ ...query, refresh: true, limit: 1 }, channelId));
  assert.notEqual(await queryKey({ ...query, report: "top_videos", limit: 10 }, channelId), await queryKey({ ...query, report: "top_videos", limit: 20 }, channelId));
  assert.notEqual(await queryKey(query, channelId), await queryKey({ ...query, videoId: "hpgBHtSgBUw" }, channelId));
});

test("archives original pages, ingests via K2 and Pipelines, then queries Basin after visibility", async () => {
  const h = harness();
  const rawPage = { ...raw(), kind: "youtubeAnalytics#resultTable" };
  const report = normalizeReport(query, rawPage, channelId, observedAt);
  const pointer = await h.warehouse.archiveReport(query, report, [rawPage]);
  assert.equal(await hash(h.objects.get(pointer.rawKey)!), pointer.snapshotId);
  assert.equal(JSON.parse(h.objects.get(pointer.rawKey)!).rawPages[0].kind, rawPage.kind);
  assert.equal(await h.warehouse.query(query), null);
  await h.warehouse.publish(pointer);
  const result = await h.warehouse.consumeBatch();
  assert.equal(result.processed, 1);
  assert.equal(result.warehouseVisible, false);
  assert.deepEqual(h.events, ["consume", "pipeline", "ack"]);
  assert.equal(await h.warehouse.query(query), null, "Pipeline acceptance is not Iceberg visibility");
  h.makeVisible();
  const stored = await h.warehouse.query(query);
  assert.deepEqual(stored?.report, report);
  assert.deepEqual(stored?.report.absentDays, ["2026-10-02", "2026-10-03"]);
  assert.equal(stored?.report.dataThrough, "2026-10-01");
});

test("replay uses the same snapshot ID and never doubles counts", async () => {
  const h = harness();
  const pointer = await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt));
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await h.warehouse.replayPointer(pointer.snapshotId), pointer);
    await h.warehouse.publish(pointer);
    await h.warehouse.consumeBatch();
    h.makeVisible();
  }
  assert.equal(h.visible.length, 2, "at-least-once delivery may create duplicate physical rows");
  const result = await h.warehouse.query(query);
  assert.equal(result?.report.rows.length, 1);
  assert.equal(result?.report.rows[0].views, 12);
});

test("an empty corrected report replaces old rows even if old snapshots arrive late", async () => {
  const h = harness();
  const old = await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt));
  const correctedRaw = { ...raw(), rows: [] };
  const corrected = await h.warehouse.archiveReport(query, normalizeReport(query, correctedRaw, channelId, "2026-10-05T08:00:00.000Z"));
  for (const pointer of [corrected, old]) {
    await h.warehouse.publish(pointer); await h.warehouse.consumeBatch(); h.makeVisible();
  }
  const result = await h.warehouse.query(query);
  assert.equal(result?.pointer.snapshotId, corrected.snapshotId);
  assert.deepEqual(result?.report.rows, []);
  assert.equal(result?.report.dataThrough, null);
});

test("a Pipeline failure releases the batch without ACK and later recovery ingests it", async () => {
  const h = harness();
  await h.warehouse.publish(await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt)));
  h.failPipeline(true);
  await assert.rejects(h.warehouse.consumeBatch());
  assert.deepEqual(h.events, ["consume", "pipeline", "nack"]);
  assert.equal(h.published.length, 1);
  h.failPipeline(false);
  await h.warehouse.consumeBatch();
  assert.equal(h.events.at(-1), "ack");
  assert.equal(h.ingested.length, 1);
});

test("K2 rejection in a resolved send is not treated as successful publication", async () => {
  const h = harness();
  h.failProduce();
  const pointer = await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt));
  await assert.rejects(h.warehouse.publish(pointer), { code: "k2_publish_failed" });
  assert.equal(h.objects.size, 1, "source archive remains available for the durable outbox");
});

test("corrupt or cross-channel snapshot references cannot be ingested", async () => {
  const h = harness();
  const pointer = await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt));
  await assert.rejects(h.warehouse.publish({ ...pointer, channelId: "UC" + "a".repeat(22) }), { code: "invalid_snapshot" });
  h.objects.set(pointer.rawKey, h.objects.get(pointer.rawKey)!.replace('"views"', '"wrong"'));
  await assert.rejects(h.warehouse.replayPointer(pointer.snapshotId), { code: "snapshot_corrupt" });
  await h.warehouse.publish(pointer);
  await assert.rejects(h.warehouse.consumeBatch(), { code: "snapshot_corrupt" });
  assert.ok(!h.events.includes("ack"));
  assert.equal(h.ingested.length, 0);
});

test("a short K2 lease is extended before processing the batch", async () => {
  const h = harness();
  h.shortLease();
  await h.warehouse.publish(await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt)));
  await h.warehouse.consumeBatch();
  assert.deepEqual(h.events, ["consume", "extend", "pipeline", "ack"]);
});

test("storage failures do not expose response bodies or auth tokens", async () => {
  const h = harness();
  h.errorHTTP(403);
  await assert.rejects(h.warehouse.query(query), error => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Analytics storage request failed (HTTP 403)");
    assert.ok(!error.message.includes("SECRET"));
    return true;
  });
});

test("runtime Pipeline records exactly match the provisioned stream schema", async () => {
  const h = harness();
  await h.warehouse.publish(await h.warehouse.archiveReport(query, normalizeReport(query, raw(), channelId, observedAt)));
  await h.warehouse.consumeBatch();
  const schema = JSON.parse(await readFile(new NodeURL("../infra/analytics-stream.schema.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(h.ingested[0]).sort(), schema.fields.map((f: { name: string }) => f.name).sort());
  for (const field of schema.fields) assert.equal(typeof h.ingested[0][field.name as keyof PipelineRecord], field.type === "int64" ? "number" : "string");
});

test("fetchReportSnapshot retains validated source pages for archiving", async () => {
  const snapshot = await fetchReportSnapshot({ async analytics<T>() { return raw() as T; } }, query, channelId);
  assert.deepEqual(snapshot.rawPages, [raw()]);
  assert.equal(snapshot.report.rows[0].views, 12);
});

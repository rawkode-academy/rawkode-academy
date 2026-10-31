import { z } from "zod";
import { analyticsSchema, normalizeReport, type AnalyticsQuery, type AnalyticsReport, type GoogleReport } from "./analytics.ts";
import { ensure, hash, readLimited, ServiceError, sha256Schema } from "./domain.ts";

// One Pipeline record is a complete, immutable report snapshot. An empty report
// is also a snapshot, so a correction that removes rows replaces older results.
// Replayed events have the same ID; SQL selects a snapshot instead of summing it.
export const MAX_REPORT_BYTES = 512 * 1024;
export const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;
const channelIdSchema = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
const timeSchema = z.iso.datetime();
const pointerSchema = z.object({
  version: z.literal(1), snapshotId: sha256Schema, queryKey: sha256Schema,
  channelId: channelIdSchema, rawKey: z.string().max(200),
}).strict();
export type SnapshotPointer = z.infer<typeof pointerSchema>;
const rawPageSchema = z.object({
  columnHeaders: z.array(z.object({ name: z.string(), columnType: z.string(), dataType: z.string() }).passthrough()).max(32),
  rows: z.array(z.array(z.union([z.string(), z.number().finite()])).max(32)).max(4000).optional(),
}).passthrough();
const archiveSchema = z.object({
  version: z.literal(1), channelId: channelIdSchema, queryKey: sha256Schema,
  query: analyticsSchema, observedAt: timeSchema,
  rawPages: z.array(rawPageSchema).min(1).max(20),
}).strict();
type Archive = z.infer<typeof archiveSchema>;

// This is also the exact structured Basin stream schema in infra/. Validating
// before send matters: Pipelines can accept, then drop, schema-invalid records.
export const pipelineRecordSchema = z.object({
  event_id: sha256Schema, query_key: sha256Schema, channel_id: channelIdSchema,
  report_type: analyticsSchema.shape.report, video_id: z.string(),
  start_date: analyticsSchema.shape.startDate, end_date: analyticsSchema.shape.endDate,
  observed_at: timeSchema, raw_key: z.string().max(200),
  row_count: z.number().int().min(0).max(4000),
  report_json: z.string().refine(v => new TextEncoder().encode(v).length <= MAX_REPORT_BYTES, "Report snapshot is too large; use a smaller date window"),
}).strict();
export type PipelineRecord = z.infer<typeof pipelineRecordSchema>;

export interface WarehousePorts {
  raw: Pick<R2Bucket, "get" | "put">;
  events: { send(records: { content: Uint8Array; headers?: Record<string, string> }[]): Promise<{ success: boolean; error?: { code: number; retryable?: boolean } }> };
  pipeline: { send(records: Record<string, unknown>[]): Promise<unknown> };
  fetcher?: typeof fetch;
  now?: () => number;
}
export interface WarehouseSettings {
  channelId: string; accountId: string; bucketName: string;
  streamId: string; subscriptionId: string; consumeToken: string; sqlToken: string;
}

export async function queryKey(input: AnalyticsQuery, channelId: string) {
  const q = analyticsSchema.parse(input);
  channelIdSchema.parse(channelId);
  return hash(JSON.stringify({ version: 1, channelId, report: q.report, startDate: q.startDate, endDate: q.endDate, videoId: q.videoId ?? null, limit: q.report === "top_videos" ? q.limit : null }));
}
function rawKey(channelId: string, snapshotId: string) { return `youtube/${channelId}/reports/${snapshotId}.json`; }
function combinedPages(pages: GoogleReport[]) {
  const first = pages[0];
  ensure(first && pages.every(p => JSON.stringify(p.columnHeaders) === JSON.stringify(first.columnHeaders)), "invalid_snapshot", "Source pages do not share one report schema", 502);
  const rows = pages.flatMap(p => p.rows ?? []);
  ensure(rows.length <= 4000, "invalid_snapshot", "Report exceeded the supported row limit", 413);
  return { columnHeaders: first.columnHeaders, rows };
}
function reportFromArchive(archive: Archive) {
  return normalizeReport(archive.query, combinedPages(archive.rawPages), archive.channelId, archive.observedAt);
}
function reportFromJSON(value: string, q: AnalyticsQuery, channelId: string, observedAt: string) {
  ensure(new TextEncoder().encode(value).length <= MAX_REPORT_BYTES, "invalid_snapshot", "Stored report exceeded the supported size", 502);
  let stored: AnalyticsReport;
  try { stored = JSON.parse(value); } catch { throw new ServiceError("invalid_snapshot", "Stored report is invalid JSON", 502); }
  ensure(stored && Array.isArray(stored.columnHeaders) && Array.isArray(stored.rows), "invalid_snapshot", "Stored report is malformed", 502);
  const raw = { columnHeaders: stored.columnHeaders, rows: stored.rows.map(row => stored.columnHeaders.map(c => row[c.name])) };
  const canonical = normalizeReport(q, raw, channelId, observedAt);
  ensure(JSON.stringify(stored) === JSON.stringify(canonical), "invalid_snapshot", "Stored report does not match the requested query", 502);
  return canonical;
}

export class Warehouse {
  private fetcher: typeof fetch;
  private now: () => number;
  constructor(private ports: WarehousePorts, private settings: WarehouseSettings) {
    this.fetcher = ports.fetcher ?? ((...args) => fetch(...args));
    this.now = ports.now ?? Date.now;
  }
  async archiveReport(input: AnalyticsQuery, report: AnalyticsReport, rawPages?: GoogleReport[]): Promise<SnapshotPointer> {
    const query = analyticsSchema.parse({ ...input, refresh: false });
    const pages = rawPages ?? [{ columnHeaders: report.columnHeaders, rows: report.rows.map(row => report.columnHeaders.map(c => row[c.name])) }];
    const archive = archiveSchema.parse({ version: 1, channelId: this.settings.channelId, queryKey: await queryKey(query, this.settings.channelId), query, observedAt: report.fetchedAt, rawPages: pages });
    ensure(JSON.stringify(reportFromArchive(archive)) === JSON.stringify(report), "invalid_snapshot", "Report and source pages do not match", 502);
    const body = JSON.stringify(archive);
    ensure(new TextEncoder().encode(body).length <= MAX_ARCHIVE_BYTES, "snapshot_too_large", "Source report is too large; use a smaller date window", 413);
    const snapshotId = await hash(body);
    const pointer: SnapshotPointer = { version: 1, snapshotId, queryKey: archive.queryKey, channelId: archive.channelId, rawKey: rawKey(archive.channelId, snapshotId) };
    this.pipelineRecord(pointer, report); // Reject anything the sink cannot hold BEFORE accepting it.
    await this.ports.raw.put(pointer.rawKey, body, { httpMetadata: { contentType: "application/json" }, customMetadata: { snapshotId, queryKey: archive.queryKey } });
    return pointer;
  }
  async publish(input: SnapshotPointer) {
    const pointer = this.validatePointer(input);
    const result = await this.ports.events.send([{ content: new TextEncoder().encode(JSON.stringify(pointer)), headers: { "event-type": "youtube.analytics.snapshot.v1", "event-id": pointer.snapshotId } }]);
    ensure(result.success, "k2_publish_failed", "K2 did not confirm ingestion; the durable outbox retains this snapshot", 503);
  }
  private validatePointer(input: unknown) {
    const p = pointerSchema.parse(input);
    ensure(p.channelId === this.settings.channelId && p.rawKey === rawKey(p.channelId, p.snapshotId), "invalid_snapshot", "Snapshot pointer does not belong to this channel", 400);
    return p;
  }
  private async readSnapshot(pointer: SnapshotPointer) {
    const object = await this.ports.raw.get(pointer.rawKey);
    ensure(object, "snapshot_not_found", "Archived source report was not found", 404);
    const bytes = await readLimited(object.body, MAX_ARCHIVE_BYTES);
    ensure(await hash(bytes) === pointer.snapshotId, "snapshot_corrupt", "Archived report checksum mismatch", 502);
    let value: unknown;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)); }
    catch { throw new ServiceError("invalid_snapshot", "Archived report is invalid JSON", 502); }
    const archive = archiveSchema.parse(value);
    ensure(archive.channelId === pointer.channelId && archive.queryKey === pointer.queryKey && await queryKey(archive.query, archive.channelId) === pointer.queryKey, "snapshot_corrupt", "Archived report identity mismatch", 502);
    return { archive, report: reportFromArchive(archive) };
  }
  async replayPointer(snapshotId: string): Promise<SnapshotPointer> {
    sha256Schema.parse(snapshotId);
    const key = rawKey(this.settings.channelId, snapshotId);
    const object = await this.ports.raw.get(key);
    ensure(object, "snapshot_not_found", "Archived source report was not found", 404);
    const bytes = await readLimited(object.body, MAX_ARCHIVE_BYTES);
    ensure(await hash(bytes) === snapshotId, "snapshot_corrupt", "Archived report checksum mismatch", 502);
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes)); }
    catch { throw new ServiceError("invalid_snapshot", "Archived report is invalid JSON", 502); }
    const archive = archiveSchema.parse(parsed);
    const pointer = this.validatePointer({ version: 1, snapshotId, queryKey: archive.queryKey, channelId: archive.channelId, rawKey: key });
    ensure(await queryKey(archive.query, archive.channelId) === pointer.queryKey, "snapshot_corrupt", "Archived query identity mismatch", 502);
    this.pipelineRecord(pointer, reportFromArchive(archive));
    return pointer;
  }
  private pipelineRecord(pointer: SnapshotPointer, report: AnalyticsReport): PipelineRecord {
    return pipelineRecordSchema.parse({
      event_id: pointer.snapshotId, query_key: pointer.queryKey, channel_id: pointer.channelId,
      report_type: report.report, video_id: report.videoId ?? "",
      start_date: report.requestedRange.startDate, end_date: report.requestedRange.endDate,
      observed_at: report.fetchedAt, raw_key: pointer.rawKey, row_count: report.rows.length,
      report_json: JSON.stringify(report),
    });
  }
  private async jsonRequest<T>(url: string, token: string, body: unknown): Promise<T> {
    ensure(token, "not_configured", "Analytics storage credentials are not configured", 503);
    const response = await this.fetcher(url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(30000), headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ServiceError("warehouse_api_error", `Analytics storage request failed (HTTP ${response.status})`, 502);
    }
    let result: { success?: boolean; result?: T };
    try { result = JSON.parse(new TextDecoder().decode(await readLimited(response.body, MAX_ARCHIVE_BYTES))); }
    catch { throw new ServiceError("warehouse_api_error", "Analytics storage returned an invalid response", 502); }
    ensure(result.success === true && result.result !== undefined, "warehouse_api_error", "Analytics storage did not confirm the operation", 502);
    return result.result;
  }
  private k2URL(path: string) {
    ensure(/^[a-f0-9]{32}$/.test(this.settings.streamId ?? "") && /^[a-f0-9]{32}$/.test(this.settings.subscriptionId ?? ""), "not_configured", "K2 stream/subscription is not configured", 503);
    return `https://${this.settings.streamId}.k2.cloudflarestorage.com/subscriptions/${this.settings.subscriptionId}/${path}`;
  }
  async consumeBatch() {
    const workerId = `youtube-${this.settings.channelId}`;
    const batch = await this.jsonRequest<{ batch_id: string | null; leased_until_ms: number | null; records: { content: string }[] }>(this.k2URL("consume"), this.settings.consumeToken, { worker_id: workerId, max_records: 10 });
    ensure(Array.isArray(batch.records) && batch.records.length <= 10, "invalid_batch", "K2 returned an invalid batch", 502);
    if (batch.records.length === 0) {
      ensure(batch.batch_id === null, "invalid_batch", "K2 returned an invalid empty batch", 502);
      return { batchId: null, processed: 0, warehouseVisible: false as const };
    }
    ensure(typeof batch.batch_id === "string" && /^[a-f0-9]{32}$/.test(batch.batch_id) && typeof batch.leased_until_ms === "number", "invalid_batch", "K2 returned invalid lease metadata", 502);
    let leasedUntil = batch.leased_until_ms;
    let processed = 0;
    try {
      for (const record of batch.records) {
        if (leasedUntil - this.now() < 60000) {
          const extension = await this.jsonRequest<{ leased_until_ms: number }>(this.k2URL(`batches/${batch.batch_id}/extend`), this.settings.consumeToken, { worker_id: workerId });
          ensure(Number.isFinite(extension.leased_until_ms) && extension.leased_until_ms > this.now(), "lease_expired", "K2 lease could not be extended", 409);
          leasedUntil = extension.leased_until_ms;
        }
        ensure(typeof record.content === "string" && record.content.length <= 4096 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(record.content), "invalid_event", "K2 snapshot pointer is not valid base64", 502);
        let value: unknown;
        try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(Uint8Array.from(atob(record.content), c => c.charCodeAt(0)))); }
        catch { throw new ServiceError("invalid_event", "K2 snapshot pointer is not valid JSON", 502); }
        const pointer = this.validatePointer(value);
        const { report } = await this.readSnapshot(pointer);
        await this.ports.pipeline.send([this.pipelineRecord(pointer, report)]);
        processed++;
      }
      // Pipeline acceptance is durable ingestion, not immediate Iceberg visibility.
      // If ACK is lost, redelivery is safe because snapshot selection is idempotent.
      await this.jsonRequest(this.k2URL(`batches/${batch.batch_id}/ack`), this.settings.consumeToken, { worker_id: workerId });
      return { batchId: batch.batch_id, processed, warehouseVisible: false as const };
    } catch (error) {
      // Never ACK a partial/failed ingestion. A failed NACK still expires naturally.
      await this.jsonRequest(this.k2URL(`batches/${batch.batch_id}/nack`), this.settings.consumeToken, { worker_id: workerId }).catch(() => {});
      throw error;
    }
  }
  async query(input: AnalyticsQuery): Promise<{ report: AnalyticsReport; pointer: SnapshotPointer } | null> {
    const query = analyticsSchema.parse(input);
    const key = await queryKey(query, this.settings.channelId);
    ensure(/^[a-f0-9]{32}$/.test(this.settings.accountId ?? "") && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(this.settings.bucketName ?? ""), "not_configured", "Basin account/bucket is not configured", 503);
    // Identifiers are fixed; both literals are strict validated IDs. No caller SQL.
    const sql = `SELECT event_id, query_key, channel_id, raw_key, observed_at, report_json FROM default.youtube_reports WHERE query_key = '${key}' AND channel_id = '${this.settings.channelId}' ORDER BY observed_at DESC, event_id DESC LIMIT 1`;
    const result = await this.jsonRequest<{ rows: Record<string, unknown>[] }>(`https://api.sql.cloudflarestorage.com/api/v1/accounts/${this.settings.accountId}/basin-sql/query/${this.settings.bucketName}`, this.settings.sqlToken, { warehouse: `${this.settings.accountId}_${this.settings.bucketName}`, query: sql });
    ensure(Array.isArray(result.rows) && result.rows.length <= 1, "invalid_snapshot", "Basin returned an invalid result", 502);
    const row = result.rows[0];
    if (!row) return null;
    const pointer = this.validatePointer({ version: 1, snapshotId: row.event_id, queryKey: row.query_key, channelId: row.channel_id, rawKey: row.raw_key });
    ensure(pointer.queryKey === key && typeof row.report_json === "string", "invalid_snapshot", "Basin returned a different report", 502);
    const observedAt = timeSchema.parse(row.observed_at);
    return { pointer, report: reportFromJSON(row.report_json, query, this.settings.channelId, observedAt) };
  }
}

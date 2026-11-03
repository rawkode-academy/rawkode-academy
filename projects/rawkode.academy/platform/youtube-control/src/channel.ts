import { DurableObject } from "cloudflare:workers";
import { z } from "zod";
import { analyticsSchema, fetchReportSnapshot, recentWindow } from "./analytics.ts";
import { ensure, errorBody, readLimited, sessionSchema, sha256Schema, videoId, type Plan, type SessionState } from "./domain.ts";
import { GoogleClient } from "./google.ts";
import { Publisher, type PublishingStore } from "./publishing.ts";
import { Warehouse, type SnapshotPointer } from "./warehouse.ts";

export type Operation = "plan" | "apply" | "broadcast" | "analytics" | "status" | "sync" | "drain" | "replay";
export type Outcome = { ok: true; value: unknown } | { ok: false; error: ReturnType<typeof errorBody> };
export class YouTubeChannel extends DurableObject<CloudflareEnv> implements PublishingStore {
  private publishingBusy = false;
  private syncBusy = false;
  private drainBusy = false;
  private flushing = false;
  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS analytics_outbox (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, pointer TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT);
      CREATE TABLE IF NOT EXISTS metadata (id TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }
  getSession(id: string): SessionState {
    const row = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM sessions WHERE id = ?", id).toArray()[0];
    return row ? JSON.parse(row.value) : { revision: 0 };
  }
  putSession(id: string, state: SessionState) {
    this.ctx.storage.sql.exec("INSERT INTO sessions(id,value) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", id, JSON.stringify(state));
  }
  getPlan(id: string): Plan | null {
    const row = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM plans WHERE id = ?", id).toArray()[0];
    return row ? JSON.parse(row.value) : null;
  }
  putPlan(plan: Plan) {
    this.ctx.storage.sql.exec("INSERT INTO plans(id,created_at,value) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", plan.planId, plan.createdAt, JSON.stringify(plan));
    this.ctx.storage.sql.exec("DELETE FROM plans WHERE created_at < ?", new Date(Date.now() - 7 * 86400000).toISOString());
  }
  private api() { return new GoogleClient(this.env.YOUTUBE_CREDENTIALS_JSON, this.env.YOUTUBE_CHANNEL_ID); }
  private warehouse() {
    return new Warehouse({ raw: this.env.ANALYTICS_RAW, events: this.env.ANALYTICS_EVENTS, pipeline: this.env.ANALYTICS_PIPELINE }, {
      channelId: this.env.YOUTUBE_CHANNEL_ID, accountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      bucketName: this.env.BASIN_BUCKET_NAME, streamId: this.env.K2_STREAM_ID, subscriptionId: this.env.K2_SUBSCRIPTION_ID,
      consumeToken: this.env.K2_CONSUME_TOKEN, sqlToken: this.env.BASIN_SQL_TOKEN,
    });
  }
  private publisher(api: GoogleClient) {
    return new Publisher(this, api, async sha => {
      const object = await this.env.ASSETS.get(`thumbnails/${sha}`);
      ensure(object, "thumbnail_not_found", "Upload the thumbnail before planning", 404);
      return readLimited(object.body, 2 * 1024 * 1024);
    }, this.env.YOUTUBE_CHANNEL_ID);
  }
  private async analytics(input: unknown, api: GoogleClient) {
    const query = analyticsSchema.parse(input);
    const warehouse = this.warehouse();
    if (!query.refresh) {
      const stored = await warehouse.query(query);
      if (stored) {
        const grant = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM metadata WHERE id='analytics_authorization'").toArray()[0];
        const verifiedAt = grant ? Date.parse(JSON.parse(grant.value).verifiedAt) : NaN;
        ensure(Number.isFinite(verifiedAt) && Date.now() - verifiedAt < 30 * 86400000, "authorization_recheck_required", "Refresh analytics to revalidate Google authorization before reading stored reports", 403);
        const ageSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(stored.report.fetchedAt)) / 1000));
        return { ...stored.report, servedFrom: "basin", freshness: { ageSeconds, refreshRecommended: ageSeconds > 36 * 60 * 60 }, storage: { snapshotId: stored.pointer.snapshotId, warehouseVisible: true } };
      }
    }
    await api.checkChannel();
    const { report, rawPages } = await fetchReportSnapshot(api, query, this.env.YOUTUBE_CHANNEL_ID);
    // A successful Analytics call validates both channel access and analytics
    // scope. Warehouse reads require this to have succeeded within 30 days.
    this.ctx.storage.sql.exec("INSERT INTO metadata(id,value) VALUES('analytics_authorization',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", JSON.stringify({ verifiedAt: new Date().toISOString() }));
    const pointer = await warehouse.archiveReport(query, report, rawPages);
    // Persist the outbox before acknowledging collection. A K2 outage cannot
    // discard a report already archived in R2. Analytics data is kept out of SQL.
    this.enqueue(pointer);
    await this.flushEvents(warehouse);
    const queued = this.ctx.storage.sql.exec("SELECT id FROM analytics_outbox WHERE id = ?", pointer.snapshotId).toArray().length > 0;
    return { ...report, servedFrom: "youtube", storage: { snapshotId: pointer.snapshotId, stage: queued ? "queued_for_k2" : "accepted_by_k2", warehouseVisible: false } };
  }
  private enqueue(pointer: SnapshotPointer) {
    this.ctx.storage.sql.exec("INSERT INTO analytics_outbox(id,created_at,pointer) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET attempts=0,last_error=NULL", pointer.snapshotId, new Date().toISOString(), JSON.stringify(pointer));
  }
  private outboxStatus() {
    const pending = this.ctx.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM analytics_outbox").toArray()[0].count;
    const blocked = this.ctx.storage.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM analytics_outbox WHERE attempts >= 5").toArray()[0].count;
    return { pending, blocked };
  }
  private async flushEvents(warehouse: Warehouse) {
    if (this.flushing) return { published: 0, ...this.outboxStatus() };
    this.flushing = true;
    let published = 0;
    try {
      const rows = this.ctx.storage.sql.exec<{ id: string; pointer: string }>("SELECT id,pointer FROM analytics_outbox WHERE attempts < 5 ORDER BY created_at LIMIT 10").toArray();
      for (const row of rows) {
        try {
          await warehouse.publish(JSON.parse(row.pointer));
          this.ctx.storage.sql.exec("DELETE FROM analytics_outbox WHERE id = ?", row.id);
          published++;
        } catch (error) {
          this.ctx.storage.sql.exec("UPDATE analytics_outbox SET attempts=attempts+1,last_error=? WHERE id=?", errorBody(error).error, row.id);
        }
      }
      return { published, ...this.outboxStatus() };
    } finally { this.flushing = false; }
  }
  private async drain() {
    ensure(!this.drainBusy, "drain_busy", "An analytics delivery is already running", 409);
    this.drainBusy = true;
    const attemptedAt = new Date().toISOString();
    try {
      const warehouse = this.warehouse();
      const outbox = await this.flushEvents(warehouse);
      const delivery = await warehouse.consumeBatch();
      const status = { attemptedAt, completedAt: new Date().toISOString(), success: outbox.pending === 0, outbox, delivery };
      this.ctx.storage.sql.exec("INSERT INTO metadata(id,value) VALUES('drain',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", JSON.stringify(status));
      return status;
    } catch (error) {
      this.ctx.storage.sql.exec("INSERT INTO metadata(id,value) VALUES('drain',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", JSON.stringify({ attemptedAt, success: false, error: errorBody(error).error }));
      throw error;
    } finally { this.drainBusy = false; }
  }
  private async sync(api: GoogleClient) {
    ensure(!this.syncBusy, "sync_busy", "An analytics refresh is already running", 409);
    this.syncBusy = true;
    const attemptedAt = new Date().toISOString();
    try {
      await api.checkChannel();
      const window = recentWindow();
      const outcomes: { report: string; dataThrough?: string | null; error?: string }[] = [];
      for (const report of ["daily", "summary", "top_videos", "traffic"] as const) {
        try { const result = await this.analytics({ report, ...window, refresh: true }, api); outcomes.push({ report, dataThrough: result.dataThrough }); }
        catch (error) { outcomes.push({ report, error: errorBody(error).error }); }
      }
      const status = { attemptedAt, completedAt: new Date().toISOString(), success: outcomes.every(o => !o.error), window, outcomes };
      this.ctx.storage.sql.exec("INSERT INTO metadata(id,value) VALUES('sync',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", JSON.stringify(status));
      // Collection and warehouse delivery have separate statuses. A successful
      // Pipelines send still does not assert that Iceberg rows are queryable yet.
      let delivery;
      try { delivery = await this.drain(); } catch (error) { delivery = { success: false, error: errorBody(error).error }; }
      return { ...status, delivery };
    } catch (error) {
      this.ctx.storage.sql.exec("INSERT INTO metadata(id,value) VALUES('sync',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value", JSON.stringify({ attemptedAt, success: false, error: errorBody(error).error }));
      throw error;
    } finally { this.syncBusy = false; }
  }
  async invoke(operation: Operation, input: unknown): Promise<Outcome> {
    try {
      if (operation === "status") {
        const sync = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM metadata WHERE id='sync'").toArray()[0];
        const drain = this.ctx.storage.sql.exec<{ value: string }>("SELECT value FROM metadata WHERE id='drain'").toArray()[0];
        return { ok: true, value: { channelId: this.env.YOUTUBE_CHANNEL_ID, authorizationConfigured: Boolean(this.env.YOUTUBE_CREDENTIALS_JSON), lastSync: sync ? JSON.parse(sync.value) : null, lastDrain: drain ? JSON.parse(drain.value) : null, outbox: this.outboxStatus(), capabilities: ["publish_upcoming_broadcast", "update_upcoming_broadcast", "thumbnail", "bind_encoder", "analytics", "k2_replay", "basin_queries"] } };
      }
      const api = this.api();
      let value: unknown;
      if (operation === "sync") value = await this.sync(api);
      else if (operation === "drain") value = await this.drain();
      else if (operation === "replay") {
        const { snapshotId } = z.object({ snapshotId: sha256Schema }).strict().parse(input);
        const warehouse = this.warehouse();
        const pointer = await warehouse.replayPointer(snapshotId);
        this.enqueue(pointer);
        const outbox = await this.flushEvents(warehouse);
        value = { snapshotId, outbox, warehouseVisible: false };
      }
      else if (operation === "analytics") value = await this.analytics(input, api);
      else if (operation === "plan") value = await this.publisher(api).plan(sessionSchema.parse(input));
      else if (operation === "apply") {
        const { planId } = z.object({ planId: z.uuid() }).strict().parse(input);
        ensure(!this.publishingBusy, "publish_busy", "Another publishing operation is running; retry after it completes", 409);
        this.publishingBusy = true;
        try { value = await this.publisher(api).apply(planId); }
        finally { this.publishingBusy = false; }
      } else if (operation === "broadcast") {
        const { broadcastId } = z.object({ broadcastId: videoId }).strict().parse(input);
        await api.checkChannel();
        const b = await api.broadcast(broadcastId);
        value = { broadcastId: b.id, ...b.snippet, privacyStatus: b.status.privacyStatus, madeForKids: b.status.selfDeclaredMadeForKids, lifeCycleStatus: b.status.lifeCycleStatus, encoderBound: Boolean(b.contentDetails?.boundStreamId), url: `https://www.youtube.com/live/${b.id}` };
      } else ensure(false, "unknown_operation", "Unknown operation", 404);
      return { ok: true, value };
    } catch (error) { return { ok: false, error: errorBody(error) }; }
  }
}

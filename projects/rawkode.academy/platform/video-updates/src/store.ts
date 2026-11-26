import type { Actor, UpdateRequest } from "./request.ts";

export type Status = "queued" | "running" | "succeeded" | "rejected" | "rolled_back" | "rollback_failed";
export type UpdateRow = { id: string; video_id: string; actor: string; status: Status; sections: string; error: string | null; event_published: number; cache_invalidated: number; created_at: string; finished_at: string | null };

const SCHEMA = [
	`CREATE TABLE IF NOT EXISTS video_updates (
		id TEXT PRIMARY KEY, video_id TEXT NOT NULL, actor TEXT NOT NULL, status TEXT NOT NULL,
		sections TEXT NOT NULL, request TEXT NOT NULL, snapshot TEXT, error TEXT,
		event_published INTEGER NOT NULL DEFAULT 0, cache_invalidated INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL, finished_at TEXT)`,
	// One update at a time per video: two interleaved updates could not be rolled back independently.
	`CREATE UNIQUE INDEX IF NOT EXISTS video_updates_one_open ON video_updates (video_id) WHERE status IN ('queued','running')`,
	`CREATE INDEX IF NOT EXISTS video_updates_video ON video_updates (video_id, created_at)`,
];
const ready = new WeakMap<D1Database, Promise<unknown>>();

export class Store {
	constructor(private db: D1Database, private now: () => Date = () => new Date()) {}
	private async ensure() {
		if (!ready.has(this.db)) ready.set(this.db, this.db.batch(SCHEMA.map((s) => this.db.prepare(s))));
		await ready.get(this.db);
	}
	// Returns false when the id is already recorded (a retried request).
	async begin(id: string, videoId: string, actor: Actor, request: UpdateRequest, sections: string[]): Promise<boolean> {
		await this.ensure();
		if (await this.db.prepare("SELECT 1 AS x FROM video_updates WHERE id = ?").bind(id).first()) return false;
		await this.db.prepare("INSERT INTO video_updates (id, video_id, actor, status, sections, request, created_at) VALUES (?, ?, ?, 'queued', ?, ?, ?)")
			.bind(id, videoId, actor.username ?? actor.userId, JSON.stringify(sections), JSON.stringify(request), this.now().toISOString()).run();
		return true;
	}
	async drop(id: string) { await this.db.prepare("DELETE FROM video_updates WHERE id = ? AND status = 'queued'").bind(id).run(); }
	async setStatus(id: string, status: Status, error?: string) {
		await this.ensure();
		const done = status !== "queued" && status !== "running";
		await this.db.prepare("UPDATE video_updates SET status = ?, error = COALESCE(?, error), finished_at = CASE WHEN ? THEN ? ELSE finished_at END WHERE id = ?").bind(status, error ?? null, done ? 1 : 0, this.now().toISOString(), id).run();
	}
	async flag(id: string, column: "event_published" | "cache_invalidated") { await this.db.prepare(`UPDATE video_updates SET ${column} = 1 WHERE id = ?`).bind(id).run(); }
	async saveSnapshot(id: string, snapshot: unknown) { await this.db.prepare("UPDATE video_updates SET snapshot = ? WHERE id = ?").bind(JSON.stringify(snapshot), id).run(); }
	async snapshot(id: string): Promise<Record<string, Record<string, unknown>[][]>> {
		const row = await this.db.prepare("SELECT snapshot FROM video_updates WHERE id = ?").bind(id).first<{ snapshot: string | null }>();
		return row?.snapshot ? JSON.parse(row.snapshot) : {};
	}
	async get(id: string): Promise<UpdateRow | null> {
		await this.ensure();
		return this.db.prepare("SELECT id, video_id, actor, status, sections, error, event_published, cache_invalidated, created_at, finished_at FROM video_updates WHERE id = ?").bind(id).first<UpdateRow>();
	}
	// Counts and times only, for the public status and the monitor.
	async stats() {
		await this.ensure();
		const since = new Date(this.now().getTime() - 24 * 3600 * 1000).toISOString();
		const stale = new Date(this.now().getTime() - 30 * 60 * 1000).toISOString();
		const n = async (sql: string, ...b: unknown[]) => (await this.db.prepare(sql).bind(...b).first<{ n: number }>())?.n ?? 0;
		return {
			rollbackFailed: await n("SELECT COUNT(*) AS n FROM video_updates WHERE status = 'rollback_failed'"),
			stuck: await n("SELECT COUNT(*) AS n FROM video_updates WHERE status IN ('queued','running') AND created_at < ?", stale),
			failedLast24h: await n("SELECT COUNT(*) AS n FROM video_updates WHERE status IN ('rolled_back','rollback_failed') AND created_at > ?", since),
			rejectedLast24h: await n("SELECT COUNT(*) AS n FROM video_updates WHERE status = 'rejected' AND created_at > ?", since),
			unpublishedEvents: await n("SELECT COUNT(*) AS n FROM video_updates WHERE status = 'succeeded' AND event_published = 0 AND created_at < ?", new Date(this.now().getTime() - 10 * 60 * 1000).toISOString()),
			succeededLast24h: await n("SELECT COUNT(*) AS n FROM video_updates WHERE status = 'succeeded' AND created_at > ?", since),
			last: await this.db.prepare("SELECT created_at, status FROM video_updates ORDER BY created_at DESC LIMIT 1").first<{ created_at: string; status: string }>(),
		};
	}
}

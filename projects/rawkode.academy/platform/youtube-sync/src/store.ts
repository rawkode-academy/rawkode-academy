import type { FieldDiff, PlanItem, Status, ThumbnailPlan } from "./plan.ts";
import type { FieldHashes, Managed, Snippet } from "./render.ts";

export type PlanRecord = { id: string; createdAt: string; templateVersion: number; fields: string[]; summary: Record<string, number> };
export type StoredItem = PlanItem;
export type LogRow = { id: number; planId: string; youtubeId: string; at: string; kind: string; result: string; detail: string | null; before: Snippet | null; after: Snippet | null };

const chunk = <T>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const parse = <T>(value: unknown): T | null => (typeof value === "string" ? (JSON.parse(value) as T) : null);

// Pacific calendar day: YouTube's quota resets at midnight Pacific.
export const pacificDay = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export class Store {
  constructor(private db: D1Database) {}

  async baselines(): Promise<Map<string, FieldHashes>> {
    const { results } = await this.db.prepare("SELECT youtube_id, base_hash FROM youtube_sync_state").all<{ youtube_id: string; base_hash: string }>();
    return new Map(results.map(row => [row.youtube_id, JSON.parse(row.base_hash) as FieldHashes]));
  }
  setBaselines(rows: { youtubeId: string; academyId: string | null; hashes: FieldHashes }[], at: string) {
    const statement = this.db.prepare("INSERT INTO youtube_sync_state (youtube_id, academy_id, base_hash, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(youtube_id) DO UPDATE SET academy_id = COALESCE(?2, academy_id), base_hash = ?3, updated_at = ?4");
    return this.batch(rows.map(row => statement.bind(row.youtubeId, row.academyId, JSON.stringify(row.hashes), at)));
  }
  // Tag of the source thumbnail we last pushed, per video.
  async thumbTags(): Promise<Map<string, string>> {
    const { results } = await this.db.prepare("SELECT youtube_id, thumb_tag FROM youtube_sync_state WHERE thumb_tag IS NOT NULL").all<{ youtube_id: string; thumb_tag: string }>();
    return new Map(results.map(row => [row.youtube_id, row.thumb_tag]));
  }
  async thumbTag(youtubeId: string): Promise<string | null> {
    return (await this.db.prepare("SELECT thumb_tag FROM youtube_sync_state WHERE youtube_id = ?1").bind(youtubeId).first<{ thumb_tag: string | null }>())?.thumb_tag ?? null;
  }
  async setThumbTag(youtubeId: string, tag: string | null, at: string) {
    await this.db.prepare("INSERT INTO youtube_sync_state (youtube_id, base_hash, thumb_tag, updated_at) VALUES (?1, '{}', ?2, ?3) ON CONFLICT(youtube_id) DO UPDATE SET thumb_tag = ?2, updated_at = ?3").bind(youtubeId, tag, at).run();
  }
  async saveThumbnailBefore(row: { planId: string; youtubeId: string; at: string; tag: string | null; image: Uint8Array | null }) {
    await this.db.prepare("INSERT INTO youtube_sync_thumbnails (plan_id, youtube_id, at, before_tag, before_image) VALUES (?1, ?2, ?3, ?4, ?5)").bind(row.planId, row.youtubeId, row.at, row.tag, row.image ? row.image.slice().buffer : null).run();
  }
  // The newest stored before-image per video, optionally for one plan or one video.
  async thumbnailBefores(filter: { planId?: string; youtubeId?: string }): Promise<{ planId: string; youtubeId: string; image: Uint8Array }[]> {
    const { results } = await this.db.prepare("SELECT plan_id, youtube_id, before_image FROM youtube_sync_thumbnails WHERE before_image IS NOT NULL AND (?1 IS NULL OR plan_id = ?1) AND (?2 IS NULL OR youtube_id = ?2) ORDER BY id DESC").bind(filter.planId ?? null, filter.youtubeId ?? null).all<{ plan_id: string; youtube_id: string; before_image: ArrayBuffer | number[] }>();
    const seen = new Set<string>();
    const rows: { planId: string; youtubeId: string; image: Uint8Array }[] = [];
    for (const row of results) if (!seen.has(row.youtube_id)) { seen.add(row.youtube_id); rows.push({ planId: row.plan_id, youtubeId: row.youtube_id, image: new Uint8Array(row.before_image as ArrayBuffer) }); }
    return rows;
  }
  private async batch(statements: D1PreparedStatement[]) {
    for (const part of chunk(statements, 50)) await this.db.batch(part);
  }

  async savePlan(plan: PlanRecord, items: PlanItem[]) {
    await this.db.prepare("INSERT INTO youtube_sync_plans (id, created_at, template_version, fields, summary) VALUES (?1, ?2, ?3, ?4, ?5)").bind(plan.id, plan.createdAt, plan.templateVersion, JSON.stringify(plan.fields), JSON.stringify(plan.summary)).run();
    const insert = this.db.prepare("INSERT INTO youtube_sync_plan_items (plan_id, youtube_id, academy_id, slug, status, reason, live_hash, desired, diff, thumb_url, thumb_tag, thumb_changed) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)");
    await this.batch(items.map(item => insert.bind(plan.id, item.youtubeId, item.academyId, item.slug, item.status, item.reason, item.liveHash, item.desired ? JSON.stringify(item.desired) : null, JSON.stringify(item.diff), item.thumbnail?.url ?? null, item.thumbnail?.tag ?? null, item.thumbnail?.changed ? 1 : 0)));
  }
  async latestPlanId(): Promise<string | null> {
    return (await this.db.prepare("SELECT id FROM youtube_sync_plans ORDER BY created_at DESC LIMIT 1").first<{ id: string }>())?.id ?? null;
  }
  async plan(id: string): Promise<{ plan: PlanRecord; items: StoredItem[] } | null> {
    const row = await this.db.prepare("SELECT * FROM youtube_sync_plans WHERE id = ?1").bind(id).first<Record<string, unknown>>();
    if (!row) return null;
    const { results } = await this.db.prepare("SELECT * FROM youtube_sync_plan_items WHERE plan_id = ?1 ORDER BY slug, youtube_id").bind(id).all<Record<string, unknown>>();
    return {
      plan: { id: String(row.id), createdAt: String(row.created_at), templateVersion: Number(row.template_version), fields: JSON.parse(String(row.fields)), summary: JSON.parse(String(row.summary)) },
      items: results.map(item => ({ youtubeId: String(item.youtube_id), academyId: (item.academy_id as string | null) ?? null, slug: (item.slug as string | null) ?? null, status: item.status as Status, reason: (item.reason as string | null) ?? null, liveHash: (item.live_hash as string | null) ?? null, desired: parse<Managed>(item.desired), diff: parse<FieldDiff[]>(item.diff) ?? [], thumbnail: typeof item.thumb_tag === "string" ? ({ url: String(item.thumb_url), tag: item.thumb_tag, changed: item.thumb_changed === 1 } satisfies ThumbnailPlan) : null })),
    };
  }

  async quotaUsed(day: string): Promise<number> {
    return (await this.db.prepare("SELECT units FROM youtube_sync_quota WHERE day = ?1").bind(day).first<{ units: number }>())?.units ?? 0;
  }
  async spend(day: string, units: number) {
    await this.db.prepare("INSERT INTO youtube_sync_quota (day, units) VALUES (?1, ?2) ON CONFLICT(day) DO UPDATE SET units = units + ?2").bind(day, units).run();
  }

  async log(row: Omit<LogRow, "id">) {
    await this.db.prepare("INSERT INTO youtube_sync_log (plan_id, youtube_id, at, kind, result, detail, before_snippet, after_snippet) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(row.planId, row.youtubeId, row.at, row.kind, row.result, row.detail, row.before ? JSON.stringify(row.before) : null, row.after ? JSON.stringify(row.after) : null).run();
  }
  // Successful writes, newest first, optionally for one plan or one video.
  async writes(filter: { planId?: string; youtubeId?: string }): Promise<LogRow[]> {
    const { results } = await this.db.prepare("SELECT * FROM youtube_sync_log WHERE result = 'ok' AND (?1 IS NULL OR plan_id = ?1) AND (?2 IS NULL OR youtube_id = ?2) ORDER BY id DESC").bind(filter.planId ?? null, filter.youtubeId ?? null).all<Record<string, unknown>>();
    return results.map(row => ({ id: Number(row.id), planId: String(row.plan_id), youtubeId: String(row.youtube_id), at: String(row.at), kind: String(row.kind), result: String(row.result), detail: (row.detail as string | null) ?? null, before: parse<Snippet>(row.before_snippet), after: parse<Snippet>(row.after_snippet) }));
  }
  async lastLog(): Promise<{ at: string; result: string; kind: string } | null> {
    return this.db.prepare("SELECT at, result, kind FROM youtube_sync_log ORDER BY id DESC LIMIT 1").first();
  }
}

import { fromMarkdown } from "@rawkodeacademy/rich-text/markdown";
import { validateDoc } from "@rawkodeacademy/rich-text/schema";
import type { Env } from "./env.ts";
import { type UpdateRequest } from "./request.ts";

type Row = Record<string, unknown>;
// One table's slice that an update replaces: everything matching `where`.
type Slice = { db: D1Database; table: string; where: string; binds: unknown[] };
const seconds = (iso: string) => Math.floor(Date.parse(iso) / 1000);

export type Step = {
	key: string;
	active(r: UpdateRequest): boolean;
	slices(env: Env, r: UpdateRequest): Slice[];
	// Statements that make the new state. May read, so a retry after a partial success is safe.
	apply(env: Env, r: UpdateRequest, now: number): Promise<D1PreparedStatement[]>;
	// Custom restore for tables where whole rows are too big to snapshot.
	restore?(env: Env, r: UpdateRequest, snapshot: Row[][]): D1PreparedStatement[];
};

const ids = (n: number) => Array.from({ length: n }, () => "?").join(",");
const bind = (db: D1Database, sql: string, ...v: unknown[]) => db.prepare(sql).bind(...v);

export function descriptionDoc(markdown: string) {
	const doc = fromMarkdown(markdown, { mdx: false, file: "description.md" });
	validateDoc(doc);
	return doc;
}

// Replaces the rows of one video in a join table.
function replaceSet<T>(key: string, active: (r: UpdateRequest) => boolean, pick: (env: Env) => D1Database, table: string, column: string, rows: (r: UpdateRequest) => T[], insert: string, values: (v: T, i: number, videoId: string) => unknown[]): Step {
	return {
		key, active,
		slices: (env, r) => [{ db: pick(env), table, where: `${column} = ?`, binds: [r.videoId] }],
		apply: async (env, r) => {
			const db = pick(env);
			return [bind(db, `DELETE FROM ${table} WHERE ${column} = ?`, r.videoId), ...rows(r).map((v, i) => bind(db, insert, ...values(v, i, r.videoId)))];
		},
	};
}

const positions = <T extends { role: string }>(items: T[]) => { const seen = new Map<string, number>(); return items.map((c) => { const n = seen.get(c.role) ?? 0; seen.set(c.role, n + 1); return n; }); };

export const STEPS: Step[] = [
	{
		key: "people", active: (r) => !!r.people?.length,
		slices: (env, r) => [{ db: env.PEOPLE, table: "people", where: `id IN (${ids(r.people!.length)})`, binds: r.people!.map((p) => p.id) }],
		apply: async (env, r, now) => {
			const out: D1PreparedStatement[] = [];
			for (const p of r.people!) {
				const { id, links: _links, ...fields } = p;
				const exists = await env.PEOPLE.prepare("SELECT 1 AS x FROM people WHERE id = ?").bind(id).first();
				const cols = Object.entries(fields).filter(([, v]) => v !== undefined);
				if (exists) { if (cols.length) out.push(bind(env.PEOPLE, `UPDATE people SET ${cols.map(([c]) => `${c} = ?`).join(", ")}, updated_at = ? WHERE id = ?`, ...cols.map(([, v]) => v), now, id)); continue; }
				const full: Row = { id, name: `${p.forename} ${p.surname}`, ...Object.fromEntries(cols), updated_at: now };
				out.push(bind(env.PEOPLE, `INSERT INTO people (${Object.keys(full).join(", ")}) VALUES (${ids(Object.keys(full).length)})`, ...Object.values(full)));
			}
			return out;
		},
	},
	{
		key: "peopleLinks", active: (r) => !!r.people?.some((p) => p.links),
		slices: (env, r) => { const p = r.people!.filter((x) => x.links); return [{ db: env.PEOPLE_LINKS, table: "people_links", where: `person_id IN (${ids(p.length)})`, binds: p.map((x) => x.id) }]; },
		apply: async (env, r) => r.people!.filter((p) => p.links).flatMap((p) => [bind(env.PEOPLE_LINKS, "DELETE FROM people_links WHERE person_id = ?", p.id), ...p.links!.map((l, i) => bind(env.PEOPLE_LINKS, "INSERT INTO people_links (person_id, url, name, position) VALUES (?, ?, ?, ?)", p.id, l.url, l.name, i))]),
	},
	{
		key: "video", active: (r) => Object.keys(r.video ?? {}).length > 0,
		slices: (env, r) => [{ db: env.VIDEOS, table: "videos", where: "id = ?", binds: [r.videoId] }],
		apply: async (env, r, now) => {
			const v = r.video!;
			const set: Row = {};
			if (v.title !== undefined) set.title = v.title;
			if (v.subtitle !== undefined) set.subtitle = v.subtitle;
			if (v.tagline !== undefined) set.tagline = v.tagline;
			if (v.slug !== undefined) set.slug = v.slug;
			if (v.description !== undefined) { set.description = v.description; set.description_doc = JSON.stringify(descriptionDoc(v.description)); }
			if (v.whatYouWillLearn !== undefined) set.what_you_will_learn = v.whatYouWillLearn === null ? null : JSON.stringify(v.whatYouWillLearn);
			if (v.publishedAt !== undefined) set.publishedAt = seconds(v.publishedAt);
			if (v.type !== undefined) set.type = v.type;
			if (v.category !== undefined) set.category = v.category;
			if (v.courseOnly !== undefined) set.course_only = v.courseOnly ? 1 : 0;
			if (v.resources !== undefined) set.resources = v.resources === null ? null : JSON.stringify(v.resources);
			set.updated_at = now;
			if (r.create) return [bind(env.VIDEOS, `INSERT OR REPLACE INTO videos (id, ${Object.keys(set).map((c) => `"${c}"`).join(", ")}) VALUES (?, ${ids(Object.keys(set).length)})`, r.videoId, ...Object.values(set))];
			return [bind(env.VIDEOS, `UPDATE videos SET ${Object.keys(set).map((c) => `"${c}" = ?`).join(", ")} WHERE id = ?`, ...Object.values(set), r.videoId)];
		},
	},
	replaceSet("credits", (r) => !!r.credits, (e) => e.CASTING_CREDITS, "casting_credits", "subject_id", (r) => { const p = positions(r.credits!); return r.credits!.map((c, i) => ({ ...c, position: p[i] })); }, "INSERT INTO casting_credits (subject_type, subject_id, person_id, role, position) VALUES ('video', ?, ?, ?, ?)", (c, _i, id) => [id, c.personId, c.role, c.position]),
	// The website's person pages still read guests from here; drop with the last reader.
	replaceSet("legacyGuests", (r) => !!r.credits, (e) => e.VIDEO_GUESTS, "video_guests", "video_id", (r) => r.credits!.filter((c) => c.role === "guest"), "INSERT INTO video_guests (video_id, guest_id, position) VALUES (?, ?, ?)", (c, i, id) => [id, c.personId, i]),
	replaceSet("technologies", (r) => !!r.technologies, (e) => e.VIDEO_TECHNOLOGIES, "video_technologies", "video_id", (r) => r.technologies!, "INSERT INTO video_technologies (video_id, technology_id, position) VALUES (?, ?, ?)", (t, i, id) => [id, t, i]),
	replaceSet("chapters", (r) => !!r.chapters, (e) => e.CHAPTERS, "chapters", "video_id", (r) => r.chapters!, "INSERT INTO chapters (video_id, seconds, title) VALUES (?, ?, ?)", (c, _i, id) => [id, c.seconds, c.title]),
	{
		key: "show", active: (r) => r.show !== undefined,
		slices: (env, r) => [{ db: env.EPISODES, table: "episodes", where: `"videoId" = ?`, binds: [r.videoId] }],
		apply: async (env, r) => [bind(env.EPISODES, `DELETE FROM episodes WHERE "videoId" = ?`, r.videoId), ...(r.show ? [bind(env.EPISODES, `INSERT INTO episodes ("videoId", "showId", code) VALUES (?, ?, ?)`, r.videoId, r.show.showId, r.show.code)] : [])],
	},
	{
		key: "courseModule", active: (r) => r.courseModule !== undefined,
		slices: (env, r) => [{ db: env.COURSES, table: "course_modules", where: "video_id = ? OR id = ?", binds: [r.videoId, r.courseModule ?? ""] }],
		apply: async (env, r, now) => [bind(env.COURSES, "UPDATE course_modules SET video_id = NULL, updated_at = ? WHERE video_id = ?", now, r.videoId), ...(r.courseModule ? [bind(env.COURSES, "UPDATE course_modules SET video_id = ?, updated_at = ? WHERE id = ?", r.videoId, now, r.courseModule)] : [])],
		// Lesson bodies are large: snapshot and restore only the link.
		restore: (env, r, [rows]) => [bind(env.COURSES, "UPDATE course_modules SET video_id = NULL WHERE video_id = ?", r.videoId), ...(r.courseModule ? [bind(env.COURSES, "UPDATE course_modules SET video_id = NULL WHERE id = ?", r.courseModule)] : []), ...rows.filter((x) => x.video_id).map((x) => bind(env.COURSES, "UPDATE course_modules SET video_id = ? WHERE id = ?", x.video_id, x.id))],
	},
	replaceSet("collaborations", (r) => !!r.collaborations, (e) => e.VIDEO_COLLABORATIONS, "video_collaborations", "video_id", (r) => r.collaborations!, "INSERT INTO video_collaborations (video_id, collaborator_id, starts_at, ends_at, cta_link) VALUES (?, ?, ?, ?, ?)", (c, _i, id) => [id, c.collaboratorId, c.startsAt ? seconds(c.startsAt) : null, c.endsAt ? seconds(c.endsAt) : null, c.ctaLink ?? null]),
	{
		key: "channels", active: (r) => !!r.channels,
		slices: (env, r) => [{ db: env.VIDEO_CHANNELS, table: "video_channels", where: `video_id = ? AND platform IN (${ids(r.channels!.length)})`, binds: [r.videoId, ...r.channels!.map((c) => c.platform)] }],
		apply: async (env, r) => [bind(env.VIDEO_CHANNELS, `DELETE FROM video_channels WHERE video_id = ? AND platform IN (${ids(r.channels!.length)})`, r.videoId, ...r.channels!.map((c) => c.platform)), ...r.channels!.map((c) => bind(env.VIDEO_CHANNELS, "INSERT INTO video_channels (video_id, platform, external_id) VALUES (?, ?, ?)", r.videoId, c.platform, c.externalId))],
	},
];

export const activeSteps = (r: UpdateRequest) => STEPS.filter((s) => s.active(r));

// What the step will replace, as it is now. Stored so a failure can put it back.
export async function snapshot(env: Env, step: Step, r: UpdateRequest): Promise<Row[][]> {
	if (step.key === "courseModule") {
		const s = step.slices(env, r)[0];
		return [(await s.db.prepare("SELECT id, video_id FROM course_modules WHERE video_id = ? OR id = ?").bind(...s.binds).all<Row>()).results];
	}
	return Promise.all(step.slices(env, r).map(async (s) => (await s.db.prepare(`SELECT * FROM ${s.table} WHERE ${s.where}`).bind(...s.binds).all<Row>()).results));
}

export function restoreStatements(env: Env, step: Step, r: UpdateRequest, snap: Row[][]): D1PreparedStatement[] {
	if (step.restore) return step.restore(env, r, snap);
	return step.slices(env, r).flatMap((s, i) => [
		bind(s.db, `DELETE FROM ${s.table} WHERE ${s.where}`, ...s.binds),
		...snap[i].map((row) => { const cols = Object.keys(row); return bind(s.db, `INSERT OR REPLACE INTO ${s.table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${ids(cols.length)})`, ...Object.values(row)); }),
	]);
}

export async function run(statements: D1PreparedStatement[], db: D1Database) {
	if (statements.length) await db.batch(statements);
}
export const dbOf = (env: Env, step: Step, r: UpdateRequest) => step.slices(env, r)[0].db;

import type { Env } from "./env.ts";
import type { UpdateRequest } from "./request.ts";
import { descriptionDoc } from "./sections.ts";

const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");
async function existing(db: D1Database, table: string, column: string, values: string[]) {
	const unique = [...new Set(values)];
	if (!unique.length) return new Set<string>();
	const { results } = await db.prepare(`SELECT ${column} AS v FROM ${table} WHERE ${column} IN (${marks(unique.length)})`).bind(...unique).all<{ v: string }>();
	return new Set(results.map((r) => r.v));
}
const missing = (label: string, wanted: string[], have: Set<string>) => [...new Set(wanted)].filter((v) => !have.has(v)).map((v) => `${label} "${v}" does not exist`);

// Everything that can be checked without writing. A failure here means nothing was touched.
export async function validate(env: Env, r: UpdateRequest): Promise<string[]> {
	const errors: string[] = [];
	const video = await env.VIDEOS.prepare("SELECT id FROM videos WHERE id = ?").bind(r.videoId).first();
	if (!video) return [`video "${r.videoId}" does not exist`];

	if (r.video?.slug) {
		const clash = await env.VIDEOS.prepare("SELECT id FROM videos WHERE slug = ? AND id <> ?").bind(r.video.slug, r.videoId).first<{ id: string }>();
		if (clash) errors.push(`slug "${r.video.slug}" is already used by video ${clash.id}`);
	}
	if (r.video?.description) { try { descriptionDoc(r.video.description); } catch (e) { errors.push(`description is not valid Markdown: ${e instanceof Error ? e.message : "unknown"}`); } }
	if (r.video?.resources) for (const [i, x] of r.video.resources.entries()) if (x.type === "url" && !x.url) errors.push(`resources[${i}] is a url but has no url`);

	const incoming = new Set((r.people ?? []).map((p) => p.id));
	if (r.people) {
		const have = await existing(env.PEOPLE, "people", "id", r.people.map((p) => p.id));
		for (const p of r.people) if (!have.has(p.id) && (!p.forename || !p.surname)) errors.push(`person "${p.id}" is new, so forename and surname are required`);
	}
	if (r.credits) {
		const keys = r.credits.map((c) => `${c.personId}:${c.role}`);
		if (new Set(keys).size !== keys.length) errors.push("credits list the same person twice in one role");
		const ids = r.credits.map((c) => c.personId).filter((id) => !incoming.has(id));
		errors.push(...missing("person", ids, await existing(env.PEOPLE, "people", "id", ids)));
	}
	if (r.technologies) {
		if (new Set(r.technologies).size !== r.technologies.length) errors.push("technologies lists one twice");
		errors.push(...missing("technology", r.technologies, await existing(env.TECHNOLOGIES, "technologies", "id", r.technologies)));
	}
	if (r.chapters && new Set(r.chapters.map((c) => c.seconds)).size !== r.chapters.length) errors.push("two chapters start at the same second");
	if (r.show) {
		errors.push(...missing("show", [r.show.showId], await existing(env.SHOWS, "shows", "id", [r.show.showId])));
		const clash = await env.EPISODES.prepare(`SELECT "videoId" AS v FROM episodes WHERE "showId" = ? AND code = ? AND "videoId" <> ?`).bind(r.show.showId, r.show.code, r.videoId).first<{ v: string }>();
		if (clash) errors.push(`episode code "${r.show.code}" in show "${r.show.showId}" belongs to video ${clash.v}`);
	}
	if (r.courseModule) errors.push(...missing("course module", [r.courseModule], await existing(env.COURSES, "course_modules", "id", [r.courseModule])));
	if (r.collaborations) {
		errors.push(...missing("collaborator", r.collaborations.map((c) => c.collaboratorId), await existing(env.VIDEO_COLLABORATIONS, "collaborators", "id", r.collaborations.map((c) => c.collaboratorId))));
		if (new Set(r.collaborations.map((c) => c.collaboratorId)).size !== r.collaborations.length) errors.push("collaborations lists one collaborator twice");
	}
	if (r.channels) {
		for (const c of r.channels) {
			const clash = await env.VIDEO_CHANNELS.prepare("SELECT video_id AS v FROM video_channels WHERE platform = ? AND external_id = ? AND video_id <> ?").bind(c.platform, c.externalId, r.videoId).first<{ v: string }>();
			if (clash) errors.push(`${c.platform} id ${c.externalId} already belongs to video ${clash.v}`);
		}
	}
	return errors;
}

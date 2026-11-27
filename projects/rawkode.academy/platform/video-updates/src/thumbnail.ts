import type { Env } from "./env.ts";
import type { UpdateRequest } from "./request.ts";

// The newest GPT Image model in the Workers AI catalogue (through AI Gateway,
// paid from its unified billing credits). Change it here when a newer one ships.
export const IMAGE_MODEL = "openai/gpt-image-2.6-sunburst";
export const GATEWAY_ID = "default";
const WIDTH = 1280;
const HEIGHT = 720;

// The key the site and the YouTube sync already read a video's thumbnail from.
export const thumbnailKey = (videoId: string) => `videos/${videoId}/thumbnail.webp`;

export type Facts = { title: string; tagline?: string | null; show?: string; technologies: string[]; people: string[]; brief?: string };

export function prompt(f: Facts): string {
	return [
		"A YouTube thumbnail for a live technical stream from Rawkode Academy, a cloud native and Kubernetes education channel.",
		"16:9 landscape, bold and legible at small sizes, dark navy background with a vivid accent colour, clean modern flat design with depth.",
		`Show the title text exactly as written, spelled correctly, in large heavy sans-serif letters: "${f.title}".`,
		f.show ? `Small label in a corner: "${f.show}".` : "",
		f.tagline ? `Theme: ${f.tagline}.` : "",
		f.technologies.length ? `Subject: ${f.technologies.join(", ")} (use abstract symbols for the technologies, no logos you are unsure of).` : "",
		f.brief ? `Art direction: ${f.brief}` : "",
		"No other text. No photographs of people or faces. No watermarks.",
	].filter(Boolean).join(" ");
}

export async function facts(env: Env, r: UpdateRequest): Promise<Facts> {
	const names = async (db: D1Database, table: string, ids: string[]) => {
		if (!ids.length) return [];
		const { results } = await db.prepare(`SELECT name FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ name: string }>();
		return results.map((x) => x.name);
	};
	const show = r.show ? (await env.SHOWS.prepare("SELECT name FROM shows WHERE id = ?").bind(r.show.showId).first<{ name: string }>())?.name : undefined;
	return { title: r.video?.title ?? "", tagline: r.video?.tagline, show, technologies: await names(env.TECHNOLOGIES, "technologies", r.technologies ?? []), people: await names(env.PEOPLE, "people", (r.credits ?? []).map((c) => c.personId)), brief: r.thumbnailBrief };
}

// The facts of a video already on the site, for making its thumbnail again (the request names only what changes).
export async function storedFacts(env: Env, videoId: string, brief?: string): Promise<Facts> {
	const names = async (db: D1Database, table: string, ids: string[]) => {
		if (!ids.length) return [];
		const { results } = await db.prepare(`SELECT name FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ name: string }>();
		return results.map((x) => x.name);
	};
	const video = await env.VIDEOS.prepare("SELECT title, tagline FROM videos WHERE id = ?").bind(videoId).first<{ title: string; tagline: string | null }>();
	const episode = await env.EPISODES.prepare(`SELECT "showId" AS s FROM episodes WHERE "videoId" = ?`).bind(videoId).first<{ s: string }>();
	const technologies = (await env.VIDEO_TECHNOLOGIES.prepare("SELECT technology_id AS t FROM video_technologies WHERE video_id = ? ORDER BY position").bind(videoId).all<{ t: string }>()).results.map((x) => x.t);
	const credits = (await env.CASTING_CREDITS.prepare("SELECT person_id AS p FROM casting_credits WHERE subject_type = 'video' AND subject_id = ? ORDER BY position").bind(videoId).all<{ p: string }>()).results.map((x) => x.p);
	return { title: video?.title ?? "", tagline: video?.tagline, show: episode ? (await names(env.SHOWS, "shows", [episode.s]))[0] : undefined, technologies: await names(env.TECHNOLOGIES, "technologies", technologies), people: await names(env.PEOPLE, "people", credits), brief };
}

// What the response looks like, for an error message: its keys and the start of each string, never the whole image.
const shape = (v: unknown): string => {
	if (v instanceof ReadableStream) return "ReadableStream";
	if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) return `binary ${(v as ArrayBuffer).byteLength} bytes`;
	if (typeof v === "string") return `string(${v.length}) "${v.slice(0, 60)}"`;
	if (Array.isArray(v)) return `[${v.slice(0, 2).map(shape).join(", ")}]`;
	if (v && typeof v === "object") return `{${Object.entries(v).slice(0, 8).map(([k, x]) => `${k}: ${shape(x)}`).join(", ")}}`;
	return String(v);
};

function fromBase64(text: string): Uint8Array {
	const clean = text.replace(/^data:[^,]*,/, "").replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
	return Uint8Array.from(atob(clean + "=".repeat((4 - (clean.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

// The model answers with an image as base64 ({ image }, { result: { image } } or OpenAI's { data: [{ b64_json }] }), as a
// data URL, as a link to fetch ({ image } or { data: [{ url }] }), or as the raw bytes.
export async function imageOf(response: unknown): Promise<Uint8Array> {
	if (response instanceof ReadableStream) return new Uint8Array(await new Response(response).arrayBuffer());
	if (response instanceof ArrayBuffer) return new Uint8Array(response);
	if (ArrayBuffer.isView(response)) return new Uint8Array(response.buffer, response.byteOffset, response.byteLength);
	const r = response as { image?: string; url?: string; data?: { b64_json?: string; url?: string }[]; result?: { image?: string } } | string | null;
	const value = typeof r === "string" ? r : r?.image ?? r?.result?.image ?? r?.data?.[0]?.b64_json ?? r?.data?.[0]?.url ?? r?.url;
	if (typeof value !== "string" || !value) throw new Error(`the image model returned no image: ${shape(response)}`);
	if (/^https:\/\//.test(value)) {
		const fetched = await fetch(value);
		if (!fetched.ok) throw new Error(`the image link answered HTTP ${fetched.status}`);
		return new Uint8Array(await fetched.arrayBuffer());
	}
	try { return fromBase64(value); } catch { throw new Error(`the image is not base64: ${shape(response)}`); }
}

// Generates the thumbnail, saves it as the video's WebP (what the site shows, and what the YouTube sync converts and uploads).
export async function generateThumbnail(env: Env, videoId: string, f: Facts): Promise<{ key: string; bytes: number }> {
	const input = { prompt: prompt(f), size: "1536x864", quality: "high", output_format: "png", n: 1 };
	let response: unknown;
	try { response = await env.AI.run(IMAGE_MODEL as never, input as never, { gateway: { id: GATEWAY_ID } } as never); }
	// Not every size is accepted; a 3:2 canvas is cropped to 16:9 below.
	catch { response = await env.AI.run(IMAGE_MODEL as never, { ...input, size: "1536x1024" } as never, { gateway: { id: GATEWAY_ID } } as never); }
	const png = await imageOf(response);
	const out = await env.IMAGES.input(new Blob([png]).stream()).transform({ width: WIDTH, height: HEIGHT, fit: "cover" }).output({ format: "image/webp", quality: 88 });
	const webp = new Uint8Array(await out.response().arrayBuffer());
	await env.CONTENT_BUCKET.put(thumbnailKey(videoId), webp, { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=3600, s-maxage=3600" }, customMetadata: { source: "video-updates", model: IMAGE_MODEL } });
	return { key: thumbnailKey(videoId), bytes: webp.byteLength };
}

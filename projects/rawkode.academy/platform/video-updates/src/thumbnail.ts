import type { Env } from "./env.ts";
import { BRAND_ACCENT, BRAND_GROUND, WORDMARK_ASPECT, WORDMARK_PNG } from "./brand.ts";
import type { UpdateRequest } from "./request.ts";

// The newest GPT Image model in the Workers AI catalogue (through AI Gateway,
// paid from its unified billing credits). Change it here when a newer one ships.
export const IMAGE_MODEL = "openai/gpt-image-2.6-sunburst";
export const GATEWAY_ID = "default";
const WIDTH = 1280;
const HEIGHT = 720;

// The key the site and the YouTube sync already read a video's thumbnail from.
export const thumbnailKey = (videoId: string) => `videos/${videoId}/thumbnail.webp`;

export type Facts = { title: string; tagline?: string | null; show?: string; technologies: string[]; people: string[]; brief?: string; hook?: string };

// A thumbnail is read at the size of a phone's video list: a few words and one clear picture. The model draws the
// art and that short hook only. Every logo is composited afterwards from real files (see composite), because a
// model invents brand marks.
export const hookOf = (f: Facts) => (f.hook ?? f.technologies[0] ?? f.title).trim().toUpperCase();

export function prompt(f: Facts): string {
	return [
		"A YouTube thumbnail background for a live technical stream from Rawkode Academy, a cloud native education channel.",
		`16:9 landscape. Dark navy ground (${BRAND_GROUND}) with one hot pink accent (${BRAND_ACCENT}) and soft light-blue highlights. Clean modern flat design with depth and glow, one strong focal object on the right half.`,
		`The only text in the image is this hook, exactly as written, spelled correctly, huge heavy white sans-serif capitals on the left, at most two lines: "${hookOf(f)}".`,
		"Keep the top-left corner, the bottom-left corner and the bottom-right corner plain dark ground: logos are added there later.",
		f.technologies.length ? `The picture is an abstract metaphor for: ${f.technologies.join(", ")}. Use simple geometric shapes only.` : `The picture is an abstract metaphor for: ${f.title}.`,
		f.brief ? `Art direction: ${f.brief}` : "",
		"No logos, no brand marks, no emblems, no recognisable trademarked symbols or mascots, no small print, no other text, no people or faces, no watermarks.",
	].filter(Boolean).join(" ");
}

export async function facts(env: Env, r: UpdateRequest): Promise<Facts> {
	const names = async (db: D1Database, table: string, ids: string[]) => {
		if (!ids.length) return [];
		const { results } = await db.prepare(`SELECT name FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ name: string }>();
		return results.map((x) => x.name);
	};
	const show = r.show ? (await env.SHOWS.prepare("SELECT name FROM shows WHERE id = ?").bind(r.show.showId).first<{ name: string }>())?.name : undefined;
	return { title: r.video?.title ?? "", tagline: r.video?.tagline, show, technologies: await names(env.TECHNOLOGIES, "technologies", r.technologies ?? []), people: await names(env.PEOPLE, "people", (r.credits ?? []).map((c) => c.personId)), brief: r.thumbnailBrief, hook: r.thumbnailHook };
}

// The facts of a video already on the site, for making its thumbnail again (the request names only what changes).
export async function storedFacts(env: Env, videoId: string, brief?: string, hook?: string): Promise<Facts> {
	const names = async (db: D1Database, table: string, ids: string[]) => {
		if (!ids.length) return [];
		const { results } = await db.prepare(`SELECT name FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all<{ name: string }>();
		return results.map((x) => x.name);
	};
	const video = await env.VIDEOS.prepare("SELECT title, tagline FROM videos WHERE id = ?").bind(videoId).first<{ title: string; tagline: string | null }>();
	const episode = await env.EPISODES.prepare(`SELECT "showId" AS s FROM episodes WHERE "videoId" = ?`).bind(videoId).first<{ s: string }>();
	const technologies = (await env.VIDEO_TECHNOLOGIES.prepare("SELECT technology_id AS t FROM video_technologies WHERE video_id = ? ORDER BY position").bind(videoId).all<{ t: string }>()).results.map((x) => x.t);
	const credits = (await env.CASTING_CREDITS.prepare("SELECT person_id AS p FROM casting_credits WHERE subject_type = 'video' AND subject_id = ? ORDER BY position").bind(videoId).all<{ p: string }>()).results.map((x) => x.p);
	return { title: video?.title ?? "", tagline: video?.tagline, show: episode ? (await names(env.SHOWS, "shows", [episode.s]))[0] : undefined, technologies: await names(env.TECHNOLOGIES, "technologies", technologies), people: await names(env.PEOPLE, "people", credits), brief, hook };
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

const LOGO_PADDING = 40;
// Our wordmark is always larger than a guest's or a technology's logo, which their brand rules ask for.
const OWN_LOGO_HEIGHT = 64;
const OTHER_LOGO_HEIGHT = 48;

// The width over the height of a PNG, from its header.
const aspectOf = (png: Uint8Array) => {
	const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
	return view.getUint32(16) / view.getUint32(20);
};

// The official logo of a technology as a PNG (white on transparent, rendered from its horizontal.svg, which the image
// binding cannot draw), or null when there isn't one.
async function technologyLogo(env: Env, id: string): Promise<{ png: Uint8Array; aspect: number } | null> {
	const object = await env.CONTENT_BUCKET.get(`technologies/${id}/horizontal.png`);
	if (!object) return null;
	const png = new Uint8Array(await object.arrayBuffer());
	return { png, aspect: aspectOf(png) };
}

type Layer = { png: Uint8Array; aspect: number; height: number; side: "left" | "right"; edge: "top" | "bottom" };

// Draws the real logos over the generated art: the Academy's top left, each technology's along the bottom right.
export async function composite(env: Env, art: Uint8Array, layers: Layer[]): Promise<Uint8Array> {
	let image = env.IMAGES.input(new Blob([art]).stream()).transform({ width: WIDTH, height: HEIGHT, fit: "cover" });
	let right = WIDTH - LOGO_PADDING;
	for (const layer of layers) {
		const width = Math.round(layer.height * layer.aspect);
		const left = layer.side === "left" ? LOGO_PADDING : right - width;
		if (layer.side === "right") right = left - LOGO_PADDING;
		const top = layer.edge === "top" ? LOGO_PADDING : HEIGHT - LOGO_PADDING - layer.height;
		image = image.draw(env.IMAGES.input(new Blob([layer.png], { type: "image/png" }).stream()).transform({ height: layer.height }), { top, left });
	}
	const out = await image.output({ format: "image/webp", quality: 88 });
	return new Uint8Array(await out.response().arrayBuffer());
}

// Generates the thumbnail, saves it as the video's WebP (what the site shows, and what the YouTube sync converts and uploads).
export async function generateThumbnail(env: Env, videoId: string, f: Facts, logos: string[] = []): Promise<{ key: string; bytes: number; logos: string[] }> {
	const input = { prompt: prompt(f), size: "1536x864", quality: "high", output_format: "png", n: 1 };
	let response: unknown;
	try { response = await env.AI.run(IMAGE_MODEL as never, input as never, { gateway: { id: GATEWAY_ID } } as never); }
	// Not every size is accepted; a 3:2 canvas is cropped to 16:9 below.
	catch { response = await env.AI.run(IMAGE_MODEL as never, { ...input, size: "1536x1024" } as never, { gateway: { id: GATEWAY_ID } } as never); }
	const art = await imageOf(response);
	const layers: Layer[] = [{ png: WORDMARK_PNG, aspect: WORDMARK_ASPECT, height: OWN_LOGO_HEIGHT, side: "left", edge: "top" }];
	const used: string[] = [];
	for (const id of logos) {
		const logo = await technologyLogo(env, id);
		if (!logo) { console.error(JSON.stringify({ operation: "video-update", level: "warn", thumbnailLogoMissing: id })); continue; }
		layers.push({ ...logo, height: OTHER_LOGO_HEIGHT, side: "right", edge: "bottom" });
		used.push(id);
	}
	const webp = await composite(env, art, layers);
	await env.CONTENT_BUCKET.put(thumbnailKey(videoId), webp, { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=3600, s-maxage=3600" }, customMetadata: { source: "video-updates", model: IMAGE_MODEL, logos: used.join(",") } });
	return { key: thumbnailKey(videoId), bytes: webp.byteLength, logos: used };
}

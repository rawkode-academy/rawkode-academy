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

// The model answers with a base64 image, either as { image } or in OpenAI's { data: [{ b64_json }] }.
export function imageOf(response: unknown): Uint8Array {
	const r = response as { image?: string; data?: { b64_json?: string }[]; result?: { image?: string } } | null;
	const b64 = r?.image ?? r?.result?.image ?? r?.data?.[0]?.b64_json;
	if (typeof b64 !== "string" || !b64) throw new Error("the image model returned no image");
	return Uint8Array.from(atob(b64.replace(/^data:[^,]*,/, "")), (c) => c.charCodeAt(0));
}

// Generates the thumbnail, saves it as the video's WebP (what the site shows, and what the YouTube sync converts and uploads).
export async function generateThumbnail(env: Env, videoId: string, f: Facts): Promise<{ key: string; bytes: number }> {
	const input = { prompt: prompt(f), size: "1536x864", quality: "high", output_format: "png", n: 1 };
	let response: unknown;
	try { response = await env.AI.run(IMAGE_MODEL as never, input as never, { gateway: { id: GATEWAY_ID } } as never); }
	// Not every size is accepted; a 3:2 canvas is cropped to 16:9 below.
	catch { response = await env.AI.run(IMAGE_MODEL as never, { ...input, size: "1536x1024" } as never, { gateway: { id: GATEWAY_ID } } as never); }
	const png = imageOf(response);
	const out = await env.IMAGES.input(new Blob([png]).stream()).transform({ width: WIDTH, height: HEIGHT, fit: "cover" }).output({ format: "image/webp", quality: 88 });
	const webp = new Uint8Array(await out.response().arrayBuffer());
	await env.CONTENT_BUCKET.put(thumbnailKey(videoId), webp, { httpMetadata: { contentType: "image/webp", cacheControl: "public, max-age=3600, s-maxage=3600" }, customMetadata: { source: "video-updates", model: IMAGE_MODEL } });
	return { key: thumbnailKey(videoId), bytes: webp.byteLength };
}

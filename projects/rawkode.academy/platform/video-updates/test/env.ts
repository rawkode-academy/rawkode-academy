import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import type { Env } from "../src/env.ts";

const platform = join(import.meta.dir, "../..");
// binding -> the platform service whose migrations define the database
const DATABASES = { VIDEOS: "videos", PEOPLE: "people", PEOPLE_LINKS: "people-links", TECHNOLOGIES: "technologies", SHOWS: "shows", EPISODES: "episodes", COURSES: "courses", CASTING_CREDITS: "casting-credits", VIDEO_GUESTS: "video-guests", VIDEO_TECHNOLOGIES: "video-technologies", CHAPTERS: "chapters", VIDEO_COLLABORATIONS: "video-collaborations", VIDEO_CHANNELS: "video-channels" } as const;

// Real D1 databases built from each service's own migrations, plus fakes for the queue and the site.
export async function testEnv() {
	const mf = new Miniflare({ modules: true, script: "export default { fetch: () => new Response() }", compatibilityDate: "2025-04-05", d1Databases: Object.fromEntries(["DB", ...Object.keys(DATABASES)].map((k) => [k, crypto.randomUUID()])) });
	const env: Record<string, unknown> = {};
	for (const binding of ["DB", ...Object.keys(DATABASES)]) env[binding] = await mf.getD1Database(binding);
	for (const [binding, service] of Object.entries(DATABASES)) {
		const dir = join(platform, service, "data-model/migrations");
		for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort())
			for (const statement of (await readFile(join(dir, file), "utf8")).split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) await (env[binding] as D1Database).prepare(statement).run();
	}
	const sent: unknown[] = [];
	const calls: { url: string; init: RequestInit }[] = [];
	env.VIDEO_UPDATED = { send: async (m: unknown) => { sent.push(m); } };
	// GPT Image, Images and the content bucket, faked: the call and the stored bytes are kept for the tests.
	const generated: { model: string; input: Record<string, unknown>; options: unknown }[] = [];
	const stored = new Map<string, { bytes: Uint8Array; options: unknown }>();
	const logos = new Map<string, Uint8Array>();
	env.AI = { run: async (model: string, input: Record<string, unknown>, options: unknown) => { generated.push({ model, input, options }); return { image: btoa("fake-png") }; } };
	const drawn: { top: number; left: number }[] = [];
	const layer = (): any => ({ transform: () => layer(), draw: (_overlay: unknown, at: { top: number; left: number }) => { drawn.push(at); return layer(); }, output: async () => ({ response: () => new Response("fake-webp") }) });
	env.IMAGES = { input: () => layer(), info: async () => ({ format: "image/png", width: 1, height: 1 }) };
	env.CONTENT_BUCKET = { get: async (key: string) => logos.has(key) ? { arrayBuffer: async () => logos.get(key)!.buffer } : null, put: async (key: string, value: Uint8Array, options: unknown) => { stored.set(key, { bytes: value, options }); } };
	env.ANALYTICS = { trackEvent: async () => ({ success: true }) };
	env.CACHE_INVALIDATION_TOKEN = "token";
	env.SITE_ORIGIN = "https://site.test";
	return { env: env as unknown as Env, sent, calls, generated, stored, drawn, logos, dispose: () => mf.dispose() };
}

export async function seed(env: Env) {
	const now = 1_700_000_000;
	await env.VIDEOS.prepare("INSERT INTO videos (id, title, slug, description, publishedAt) VALUES ('v1', 'Old title', 'old-title', 'Old description', ?)").bind(now).run();
	await env.VIDEOS.prepare("INSERT INTO videos (id, title, slug, description, publishedAt) VALUES ('v2', 'Other', 'other', 'x', ?)").bind(now).run();
	await env.PEOPLE.prepare("INSERT OR IGNORE INTO people (id, forename, surname, name) VALUES ('rawkode', 'David', 'Flanagan', 'David Flanagan')").run();
	await env.TECHNOLOGIES.prepare("INSERT OR IGNORE INTO technologies (id, name, description) VALUES ('kubernetes', 'Kubernetes', 'k'), ('helm', 'Helm', 'h')").run();
	await env.SHOWS.prepare("INSERT OR IGNORE INTO shows (id, name) VALUES ('rawkode-live', 'Rawkode Live')").run();
	await env.VIDEO_COLLABORATIONS.prepare("INSERT OR IGNORE INTO collaborators (id, name, website_url) VALUES ('datum', 'Datum', 'https://datum.net')").run();
	await env.VIDEO_TECHNOLOGIES.prepare("INSERT INTO video_technologies (video_id, technology_id, position) VALUES ('v1', 'helm', 0)").run();
	await env.CHAPTERS.prepare("INSERT INTO chapters (video_id, seconds, title) VALUES ('v1', 0, 'Old chapter')").run();
	await env.CASTING_CREDITS.prepare("INSERT INTO casting_credits (subject_type, subject_id, person_id, role, position) VALUES ('video', 'v1', 'rawkode', 'host', 0)").run();
}

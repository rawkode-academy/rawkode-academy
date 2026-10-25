// In-process CMS for tests: every write-model binding is a real ContentStore
// over a Miniflare D1 with that service's migrations, and the CMS database
// has its own migrations applied.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	type ChangeEvent,
	ContentStore,
	describeModels,
	type ServiceModels,
} from "@rawkodeacademy/content-write";
import type { ContentWriteRpc } from "@rawkodeacademy/content-write/worker";
import { Miniflare } from "miniflare";
import type { ApiEnv } from "../src/lib/api";
import { handleApi, resetDescribeCacheForTests } from "../src/lib/api";
import type { Principal } from "../src/lib/auth";
import type { Binding } from "../src/lib/collections";

const PLATFORM = join(import.meta.dir, "../../platform");

const SERVICES: Record<Binding, string> = {
	WRITE_PEOPLE: "people",
	WRITE_PEOPLE_LINKS: "people-links",
	WRITE_PEOPLE_BIOGRAPHIES: "people-biographies",
	WRITE_TECHNOLOGIES: "technologies",
	WRITE_TRANSCRIPTION_TERMS: "transcription-terms",
	WRITE_SHOWS: "shows",
	WRITE_SHOW_HOSTS: "show-hosts",
	WRITE_VIDEOS: "videos",
	WRITE_VIDEO_GUESTS: "video-guests",
	WRITE_VIDEO_TECHNOLOGIES: "video-technologies",
	WRITE_CHAPTERS: "chapters",
	WRITE_EPISODES: "episodes",
	WRITE_ARTICLES: "articles",
	WRITE_NEWS: "news",
	WRITE_CHANGELOG: "changelog",
	WRITE_ADRS: "adrs",
	WRITE_TESTIMONIALS: "testimonials",
	WRITE_COURSES: "courses",
};

async function exec(DB: D1Database, sql: string) {
	const statements = sql
		.split(/--> statement-breakpoint|;\s*\n/)
		.map((s) => s.replace(/^\s*--.*$/gm, "").trim())
		.filter(Boolean);
	for (const statement of statements) await DB.prepare(statement).run();
}

async function migrate(DB: D1Database, dir: string) {
	for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort()) {
		await exec(DB, await readFile(join(dir, file), "utf8"));
	}
}

export interface Harness {
	env: ApiEnv;
	events: ChangeEvent[];
	media: Map<string, { bytes: Uint8Array; contentType?: string }>;
	call(
		principal: Principal | null,
		method: string,
		path: string,
		body?: unknown,
		init?: { origin?: string; form?: FormData },
	): Promise<{ status: number; json: any }>;
	dispose(): Promise<void>;
}

export async function harness(bindings: Binding[]): Promise<Harness> {
	resetDescribeCacheForTests();
	const mf = new Miniflare({
		modules: true,
		script: "export default { fetch: () => new Response() }",
		compatibilityDate: "2025-04-05",
		d1Databases: ["CMS", ...bindings],
	});
	const events: ChangeEvent[] = [];
	const queue = {
		send: async (event: ChangeEvent) => {
			events.push(event);
		},
	} as unknown as Queue<ChangeEvent>;
	const services: ApiEnv["services"] = {};
	for (const binding of bindings) {
		const dir = join(PLATFORM, SERVICES[binding]);
		const DB = (await mf.getD1Database(binding)) as unknown as D1Database;
		await migrate(DB, join(dir, "data-model/migrations"));
		const { models } = (await import(join(dir, "write-model/models.ts"))) as {
			models: ServiceModels;
		};
		const store = new ContentStore(models, { DB, CONTENT_CHANGES: queue });
		services[binding] = {
			describe: async () => describeModels(models),
			models: async () => store.models(),
			get: (...a) => store.get(...a),
			list: (...a) => store.list(...a),
			revisions: (...a) => store.revisions(...a),
			getList: (...a) => store.getList(...a),
			findReferences: (...a) => store.findReferences(...a),
			create: (...a) => store.create(...a),
			update: (...a) => store.update(...a),
			delete: (...a) => store.delete(...a),
			restore: (...a) => store.restore(...a),
			setList: (...a) => store.setList(...a),
		} as unknown as ContentWriteRpc;
	}
	const DB = (await mf.getD1Database("CMS")) as unknown as D1Database;
	await migrate(DB, join(import.meta.dir, "../migrations"));
	const media = new Map<string, { bytes: Uint8Array; contentType?: string }>();
	const MEDIA = {
		put: async (key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }) => {
			media.set(key, { bytes: value, contentType: options?.httpMetadata?.contentType });
		},
	} as unknown as R2Bucket;
	let clock = Date.parse("2026-10-25T12:00:00Z");
	const env: ApiEnv = { DB, services, MEDIA, now: () => clock++ };
	const origin = "https://cms.rawkode.academy";
	return {
		env,
		events,
		media,
		async call(principal, method, path, body, init = {}) {
			const headers: Record<string, string> = {};
			if (body !== undefined) headers["content-type"] = "application/json";
			if (init.origin !== undefined) headers.origin = init.origin;
			else if (method !== "GET") headers.origin = origin;
			const request = new Request(`${origin}/api/v1${path}`, {
				method,
				headers,
				...(init.form ? { body: init.form } : body !== undefined ? { body: JSON.stringify(body) } : {}),
			});
			const response = await handleApi(env, {
				request,
				path: new URL(request.url).pathname.replace(/^\/api\/v1/, ""),
				principal,
				origin,
			});
			return { status: response.status, json: await response.json() };
		},
		dispose: () => mf.dispose(),
	};
}

const person = (id: string, roles: Principal["roles"], via: Principal["via"] = "session"): Principal => ({
	actor: { id, kind: via === "token" ? "agent" : "user", name: id },
	roles,
	via,
});

export const ADMIN = person("david", ["content_admin"]);
export const AGENT = person("token:news", ["content_agent"], "token");
export const GUEST = person("guest-user", ["content_guest"]);
export const PARTNER = person("partner-user", ["content_partner"]);

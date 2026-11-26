import { afterAll, beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Env } from "../src/env.ts";
import { updateRequest, type UpdateRequest } from "../src/request.ts";
import { activeSteps } from "../src/sections.ts";
import { Store } from "../src/store.ts";
import { validate } from "../src/validate.ts";
import { seed, testEnv } from "./env.ts";

// The workflow runtime isn't available under Bun: run its steps inline.
mock.module("cloudflare:workers", () => ({ WorkflowEntrypoint: class { env: unknown; constructor(_c: unknown, env: unknown) { this.env = env; } } }));
mock.module("cloudflare:workflows", () => ({ NonRetryableError: class extends Error {} }));
const { UpdateVideoWorkflow } = await import("../src/workflow.ts");

const invalidations: string[] = [];
globalThis.fetch = (async (url: unknown) => { invalidations.push(String(url)); return new Response("{}"); }) as typeof fetch;
let t: Awaited<ReturnType<typeof testEnv>>;
let env: Env;
beforeAll(async () => { t = await testEnv(); env = t.env; });
afterAll(async () => { await t.dispose(); });

const failing = new Set<string>();
const step = { do: async (name: string, a: unknown, b?: unknown) => { const cb = (b ?? a) as () => Promise<unknown>; if (failing.has(name)) throw new Error(`boom in ${name}`); return cb(); } };
const rows = async (db: D1Database, sql: string) => (await db.prepare(sql).all()).results;
const snapshotOf = async () => JSON.stringify([
	await rows(env.VIDEOS, "SELECT * FROM videos ORDER BY id"), await rows(env.PEOPLE, "SELECT * FROM people ORDER BY id"), await rows(env.PEOPLE_LINKS, "SELECT * FROM people_links"),
	await rows(env.CASTING_CREDITS, "SELECT * FROM casting_credits"), await rows(env.VIDEO_GUESTS, "SELECT * FROM video_guests"), await rows(env.VIDEO_TECHNOLOGIES, "SELECT * FROM video_technologies"),
	await rows(env.CHAPTERS, "SELECT * FROM chapters"), await rows(env.EPISODES, "SELECT * FROM episodes"), await rows(env.VIDEO_COLLABORATIONS, "SELECT * FROM video_collaborations"), await rows(env.VIDEO_CHANNELS, "SELECT * FROM video_channels"),
]);

const full: UpdateRequest = updateRequest.parse({
	videoId: "v1",
	video: { title: "New title", slug: "new-title", description: "Hello **world**", type: "live", category: "tutorial", resources: [{ title: "Slides", type: "url", url: "https://example.com/s", category: "slides" }], whatYouWillLearn: ["one", "two"] },
	people: [{ id: "newguest", forename: "Ada", surname: "Lovelace", github: "ada", links: [{ url: "https://ada.example", name: "Blog" }] }],
	credits: [{ personId: "rawkode", role: "host" }, { personId: "newguest", role: "guest" }],
	technologies: ["kubernetes", "helm"],
	chapters: [{ seconds: 0, title: "Intro" }, { seconds: 90, title: "Demo" }],
	show: { showId: "rawkode-live", code: "S01E01" },
	collaborations: [{ collaboratorId: "datum", ctaLink: "https://example.com/cta" }],
	channels: [{ platform: "youtube", externalId: "abcdefghijk" }],
});

const run = (id: string, request: UpdateRequest) => new (UpdateVideoWorkflow as any)({}, env).run({ payload: { updateId: id, actor: { userId: "u1" }, request }, timestamp: new Date("2026-11-26T20:00:00Z") }, step);
const begin = (id: string, request: UpdateRequest) => new Store(env.DB).begin(id, request.videoId, { userId: "u1" }, request, activeSteps(request).map((s) => s.key));

describe("validate", () => {
	beforeEach(async () => { failing.clear(); });
	it("accepts a good request and rejects missing references", async () => {
		await seed(env);
		expect(await validate(env, full)).toEqual([]);
		const bad = updateRequest.parse({ videoId: "v1", technologies: ["nope"], credits: [{ personId: "ghost", role: "guest" }], show: { showId: "x", code: "c" }, collaborations: [{ collaboratorId: "zzz" }], video: { slug: "other" } });
		const errors = await validate(env, bad);
		expect(errors.join("|")).toContain('technology "nope"');
		expect(errors.join("|")).toContain('person "ghost"');
		expect(errors.join("|")).toContain('show "x"');
		expect(errors.join("|")).toContain('collaborator "zzz"');
		expect(errors.join("|")).toContain('slug "other" is already used');
		expect(await validate(env, updateRequest.parse({ videoId: "missing", video: { title: "x" } }))).toEqual(['video "missing" does not exist']);
	});
	it("refuses unknown fields", () => { expect(() => updateRequest.parse({ videoId: "v1", video: { youtubeId: "x" } })).toThrow(); });
});

describe("workflow", () => {
	it("writes every section, publishes the event and records success", async () => {
		await begin("u-ok", full);
		await run("u-ok", full);
		expect((await rows(env.VIDEOS, "SELECT title, slug, type, category, description_doc FROM videos WHERE id='v1'"))[0]).toMatchObject({ title: "New title", slug: "new-title", type: "live", category: "tutorial" });
		expect(String((await rows(env.VIDEOS, "SELECT description_doc d FROM videos WHERE id='v1'"))[0].d)).toContain("world");
		expect(await rows(env.PEOPLE, "SELECT id, name FROM people WHERE id='newguest'")).toEqual([{ id: "newguest", name: "Ada Lovelace" }]);
		expect(await rows(env.PEOPLE_LINKS, "SELECT url FROM people_links WHERE person_id='newguest'")).toEqual([{ url: "https://ada.example" }]);
		expect(await rows(env.CASTING_CREDITS, "SELECT person_id, role, position FROM casting_credits ORDER BY role")).toEqual([{ person_id: "newguest", role: "guest", position: 0 }, { person_id: "rawkode", role: "host", position: 0 }]);
		expect(await rows(env.VIDEO_GUESTS, "SELECT guest_id FROM video_guests WHERE video_id='v1'")).toEqual([{ guest_id: "newguest" }]);
		expect(await rows(env.VIDEO_TECHNOLOGIES, "SELECT technology_id t FROM video_technologies ORDER BY position")).toEqual([{ t: "kubernetes" }, { t: "helm" }]);
		expect(await rows(env.CHAPTERS, "SELECT seconds FROM chapters WHERE video_id='v1' ORDER BY seconds")).toEqual([{ seconds: 0 }, { seconds: 90 }]);
		expect(await rows(env.EPISODES, `SELECT "showId" s, code FROM episodes`)).toEqual([{ s: "rawkode-live", code: "S01E01" }]);
		expect(await rows(env.VIDEO_COLLABORATIONS, "SELECT collaborator_id c FROM video_collaborations WHERE video_id='v1'")).toEqual([{ c: "datum" }]);
		expect(await rows(env.VIDEO_CHANNELS, "SELECT external_id e FROM video_channels WHERE video_id='v1'")).toEqual([{ e: "abcdefghijk" }]);
		expect(invalidations).toEqual(["https://site.test/api/cache/invalidate"]);
		expect(t.sent).toHaveLength(1);
		expect(t.sent[0]).toMatchObject({ type: "video.updated", videoId: "v1", updateId: "u-ok" });
		expect((await new Store(env.DB).get("u-ok"))?.status).toBe("succeeded");
	});

	it("leaves a video's other sections alone when they are not in the request", async () => {
		const before = await rows(env.CHAPTERS, "SELECT * FROM chapters ORDER BY seconds");
		const r = updateRequest.parse({ videoId: "v1", video: { tagline: "A tagline" } });
		await begin("u-tag", r);
		await run("u-tag", r);
		expect(await rows(env.CHAPTERS, "SELECT * FROM chapters ORDER BY seconds")).toEqual(before);
		expect((await rows(env.VIDEOS, "SELECT tagline FROM videos WHERE id='v1'"))[0]).toEqual({ tagline: "A tagline" });
	});

	it("puts everything back when a later section fails", async () => {
		const r = updateRequest.parse({ ...full, videoId: "v2", show: undefined, channels: undefined, video: { title: "Changed", slug: "changed" }, people: [{ id: "rollme", forename: "Roll", surname: "Back" }], credits: [{ personId: "rollme", role: "guest" }], technologies: ["helm"], chapters: [{ seconds: 5, title: "x" }], collaborations: [{ collaboratorId: "datum" }] });
		const before = await snapshotOf();
		const sentBefore = t.sent.length;
		failing.add("write collaborations");
		await begin("u-fail", r);
		await expect(run("u-fail", r)).rejects.toThrow("rolled back");
		expect(await snapshotOf()).toBe(before);
		expect(t.sent.length).toBe(sentBefore);
		expect((await new Store(env.DB).get("u-fail"))?.status).toBe("rolled_back");
		failing.clear();
	});

	it("rejects without writing when validation fails", async () => {
		const r = updateRequest.parse({ videoId: "v1", technologies: ["nope"], video: { title: "Should not land" } });
		const before = await snapshotOf();
		await begin("u-bad", r);
		await expect(run("u-bad", r)).rejects.toThrow("rejected");
		expect(await snapshotOf()).toBe(before);
		expect((await new Store(env.DB).get("u-bad"))?.status).toBe("rejected");
	});

	it("runs one update per video and treats a repeated request id as the same update", async () => {
		const r = updateRequest.parse({ videoId: "v2", video: { tagline: "x" } });
		expect(await begin("same-1", r)).toBe(true);
		expect(await begin("same-1", r)).toBe(false);
		await expect(begin("same-2", r)).rejects.toThrow();
	});

	it("reports alertable counts", async () => {
		const stats = await new Store(env.DB).stats();
		expect(stats.failedLast24h).toBeGreaterThanOrEqual(1);
		expect(stats.rollbackFailed).toBe(0);
	});
});

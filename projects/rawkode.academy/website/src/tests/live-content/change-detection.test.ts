import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildManifest,
	diffManifests,
	MANIFEST_KEY,
	runChangeDetection,
} from "@/lib/live-content/change-detection";
import { SETTLE_MS } from "@/lib/live-content/invalidate";
import {
	GENERATION_KEY,
	resetContentCacheForTests,
} from "@/lib/live-content/kv-cache";
import { memoryKv } from "./memory-kv";

const HOUR = 3_600_000;
const T0 = Date.parse("2026-10-23T10:00:00Z");

const video = (id: string, over: Record<string, unknown> = {}) => ({
	id,
	slug: id,
	title: `Video ${id}`,
	description: "A description long enough",
	publishedAt: new Date(T0 - HOUR).toISOString(),
	guests: [{ id: "guest" }],
	technologies: [{ id: "kubernetes" }],
	episode: { code: "1", show: { id: "rawkode-live" } },
	...over,
});
const news = (id: string, publishedAt: number) => ({
	id,
	title: id,
	description: id,
	publishedAt: new Date(publishedAt).toISOString(),
	authors: [{ id: "rawkode" }],
	technologies: [],
	body: { type: "doc", content: [{ type: "paragraph" }] },
});

describe("manifest", () => {
	it("keys entities by collection and id, with hash, publication time and related tags", () => {
		const manifest = buildManifest(
			{
				videos: [video("v1")],
				courses: [
					{
						id: "course",
						title: "C",
						publishedAt: new Date(T0).toISOString(),
						modules: [
							{
								id: "course/intro",
								courseId: "course",
								slug: "intro",
								publishedAt: new Date(T0).toISOString(),
							},
						],
					},
				],
			},
			T0,
		);
		expect(Object.keys(manifest.entities).sort()).toEqual([
			"courseModules:course/intro",
			"courses:course",
			"videos:v1",
		]);
		const v1 = manifest.entities["videos:v1"]!;
		expect(v1.p).toBe(T0 - HOUR);
		expect(v1.r?.sort()).toEqual([
			"people:guest",
			"shows:rawkode-live",
			"technologies:kubernetes",
		]);
		expect(manifest.entities["courseModules:course/intro"]!.r).toContain(
			"courses:course",
		);
	});

	it("produces a stable hash regardless of key order", () => {
		const a = buildManifest(
			{ videos: [{ id: "v", title: "x", slug: "v" }] },
			T0,
		);
		const b = buildManifest(
			{ videos: [{ slug: "v", title: "x", id: "v" }] },
			T0,
		);
		expect(a.entities["videos:v"]!.h).toBe(b.entities["videos:v"]!.h);
	});
});

describe("diffManifests", () => {
	const previous = buildManifest(
		{
			videos: [
				video("same"),
				video("edited"),
				video("removed", { guests: [{ id: "old-guest" }] }),
			],
			news: [news("scheduled", T0 + 30 * 60_000), news("later", T0 + 5 * HOUR)],
		},
		T0,
	);

	it("reports nothing on the first run (baseline)", () => {
		expect(diffManifests(undefined, previous).tags).toEqual([]);
	});

	it("finds added, changed, deleted and newly published entities and their tags", () => {
		const next = buildManifest(
			{
				videos: [
					video("same"),
					video("edited", {
						title: "New title",
						guests: [{ id: "new-guest" }],
					}),
					video("added"),
				],
				news: [
					news("scheduled", T0 + 30 * 60_000),
					news("later", T0 + 5 * HOUR),
				],
			},
			T0 + HOUR,
		);
		const diff = diffManifests(previous, next);
		expect(diff.added).toEqual(["videos:added"]);
		expect(diff.changed).toEqual(["videos:edited"]);
		expect(diff.deleted).toEqual(["videos:removed"]);
		expect(diff.published).toEqual(["news:scheduled"]);
		for (const tag of [
			"videos",
			"videos:added",
			"videos:edited",
			"videos:removed",
			"people:new-guest",
			// the guest removed from an edited video, and guests of a deleted one
			"people:guest",
			"people:old-guest",
			"news",
			"news:scheduled",
			"people:rawkode",
		]) {
			expect(diff.tags).toContain(tag);
		}
		expect(diff.tags).not.toContain("videos:same");
		expect(diff.tags).not.toContain("news:later");
	});
});

describe("runChangeDetection", () => {
	let clock = T0;
	beforeEach(() => {
		clock = T0;
		resetContentCacheForTests(() => clock);
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("stores a baseline, then bumps the generation and purges changed tags in batches", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async (_tags: string[]) => {});
		let videos = [video("a")];
		const loadSources = async () => ({ videos, news: [] });

		const baseline = await runChangeDetection({
			env: {},
			kv,
			purge,
			loadSources,
			settleMs: 0,
		});
		expect(baseline.baseline).toBe(true);
		expect(purge).not.toHaveBeenCalled();
		expect(kv.store.has(GENERATION_KEY)).toBe(false);
		expect(JSON.parse(kv.store.get(MANIFEST_KEY)!).entities).toHaveProperty([
			"videos:a",
		]);

		clock = T0 + HOUR;
		videos = [
			video("a", { title: "changed" }),
			...Array.from({ length: 40 }, (_, i) => video(`n${i}`)),
		];
		const result = await runChangeDetection({
			env: {},
			kv,
			purge,
			loadSources,
			settleMs: 0,
		});
		expect(result.diff.added).toHaveLength(40);
		expect(result.diff.changed).toEqual(["videos:a"]);
		expect(result.generation).toBe(clock);
		expect(JSON.parse(kv.store.get(GENERATION_KEY)!).generation).toBe(clock);
		const purged = purge.mock.calls.flatMap(([tags]) => tags);
		expect(purge.mock.calls.every(([tags]) => tags.length <= 30)).toBe(true);
		expect(new Set(purged)).toEqual(new Set(result.diff.tags));
	});

	it("does nothing when nothing changed", async () => {
		const kv = memoryKv();
		const purge = vi.fn(async () => {});
		const loadSources = async () => ({ videos: [video("a")] });
		await runChangeDetection({
			env: {},
			kv,
			purge,
			loadSources,
			settleMs: 0,
		});
		clock += HOUR;
		const result = await runChangeDetection({
			env: {},
			kv,
			purge,
			loadSources,
			settleMs: 0,
		});
		expect(result.diff.tags).toEqual([]);
		expect(purge).not.toHaveBeenCalled();
		expect(kv.store.has(GENERATION_KEY)).toBe(false);
	});

	it("keeps the previous manifest when a source fails", async () => {
		const kv = memoryKv();
		await runChangeDetection({
			env: {},
			kv,
			loadSources: async () => ({ videos: [video("a")] }),
		});
		const before = kv.store.get(MANIFEST_KEY);
		await expect(
			runChangeDetection({
				env: {},
				kv,
				loadSources: async () => {
					throw new Error("gateway down");
				},
			}),
		).rejects.toThrow("gateway down");
		expect(kv.store.get(MANIFEST_KEY)).toBe(before);
	});
});

describe("runChangeDetection purge robustness", () => {
	beforeEach(() => {
		resetContentCacheForTests(() => T0);
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	it("purges twice (after the settle delay) and keeps the old manifest when a purge fails", async () => {
		const kv = memoryKv();
		await runChangeDetection({
			env: {},
			kv,
			loadSources: async () => ({ videos: [video("a")] }),
		});
		const before = kv.store.get(MANIFEST_KEY);
		const waits: number[] = [];
		let calls = 0;
		const failingSecond = async () => {
			calls++;
			if (calls > 1) throw new Error("purge rate limited");
		};
		resetContentCacheForTests(() => T0 + HOUR);
		await expect(
			runChangeDetection({
				env: {},
				kv,
				purge: failingSecond,
				wait: async (ms) => {
					waits.push(ms);
				},
				loadSources: async () => ({ videos: [video("a", { title: "new" })] }),
			}),
		).rejects.toThrow("purge rate limited");
		expect(waits).toEqual([SETTLE_MS]);
		// Not stored: the next run reports the change again.
		expect(kv.store.get(MANIFEST_KEY)).toBe(before);
		const retry = await runChangeDetection({
			env: {},
			kv,
			purge: async () => {},
			settleMs: 0,
			loadSources: async () => ({ videos: [video("a", { title: "new" })] }),
		});
		expect(retry.diff.changed).toEqual(["videos:a"]);
	});
});

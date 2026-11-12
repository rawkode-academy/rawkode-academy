import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	emptyStudioLiveState,
	getStudioLiveState,
	parseStudioLiveState,
	shouldMountStudioLiveGate,
	studioLiveStateUrl,
	type StudioLiveState,
} from "@/lib/studio-live";

afterEach(() => vi.useRealTimers());

describe("Studio live state", () => {
	it("parses only active live states with WHEP playback URLs", () => {
		expect(parseStudioLiveState({ live: false })).toEqual(
			emptyStudioLiveState(),
		);
		expect(parseStudioLiveState({ live: true })).toEqual(
			emptyStudioLiveState(),
		);

		expect(
			parseStudioLiveState({
				live: true,
				playbackUrl: "https://stream.example/webRTC/play",
				session: {
					id: "session-1",
					show: "Rawkode Live",
					startedAt: 123,
					startsAt: "2026-08-01T10:00:00.000Z",
					title: "Future event",
				},
			}),
		).toEqual({
			live: true,
			playbackUrl: "https://stream.example/webRTC/play",
			session: {
				id: "session-1",
				show: "Rawkode Live",
				startedAt: 123,
				startsAt: "2026-08-01T10:00:00.000Z",
				title: "Future event",
			},
		});
	});

	it("fetches live state through the Studio service binding", async () => {
		const studio = {
			fetch: vi.fn(async (request: Request) => {
				expect(request.url).toBe(
					"https://studio.internal/api/studio/live-state?videoSlug=future-event",
				);
				return new Response(
					JSON.stringify({
						live: true,
						playbackUrl: "https://stream.example/webRTC/play",
						session: {
							id: "session-1",
							show: "Rawkode Live",
							startedAt: 123,
							startsAt: "2026-08-01T10:00:00.000Z",
							title: "Future event",
						},
					}),
				);
			}),
		} as unknown as Fetcher;

		await expect(
			getStudioLiveState({ STUDIO: studio }, "future-event"),
		).resolves.toMatchObject({
			live: true,
			playbackUrl: "https://stream.example/webRTC/play",
		});
		expect(studio.fetch).toHaveBeenCalledTimes(1);
		expect(studioLiveStateUrl("future-event")).toBe(
			"https://studio.internal/api/studio/live-state?videoSlug=future-event",
		);
	});

	it("falls back when the Studio service does not respond and aborts its request", async () => {
		vi.useFakeTimers();
		let request: Request | undefined;
		let finish!: (response: Response) => void;
		const studio = {
			fetch: vi.fn((input: Request) => {
				request = input;
				return new Promise<Response>((resolve) => { finish = resolve; });
			}),
		} as unknown as Fetcher;
		const pending = getStudioLiveState({ STUDIO: studio }, "future-event");
		await vi.advanceTimersByTimeAsync(2_000);
		await expect(pending).resolves.toEqual(emptyStudioLiveState());
		expect(request?.signal.aborted).toBe(true);
		finish(new Response(JSON.stringify({ live: true, playbackUrl: "https://stream.example/late" })));
		await Promise.resolve();
	});

	it("falls back when the Studio response body stalls", async () => {
		vi.useFakeTimers();
		let request: Request | undefined;
		let finish!: (value: unknown) => void;
		const body = new Promise<unknown>((resolve) => { finish = resolve; });
		const studio = {
			fetch: vi.fn(async (input: Request) => {
				request = input;
				return { ok: true, json: () => body } as Response;
			}),
		} as unknown as Fetcher;
		const pending = getStudioLiveState({ STUDIO: studio }, "future-event");
		await vi.advanceTimersByTimeAsync(2_000);
		await expect(pending).resolves.toEqual(emptyStudioLiveState());
		expect(request?.signal.aborted).toBe(true);
		finish({ live: true, playbackUrl: "https://stream.example/late" });
		await Promise.resolve();
	});

	it("mounts the live gate for active, upcoming, and bounded late streams", () => {
		const now = new Date("2026-08-01T12:00:00.000Z");
		const inactiveLiveState = emptyStudioLiveState();
		const activeLiveState = {
			live: true,
			playbackUrl: "https://stream.example/webRTC/play",
			session: {
				id: "session-1",
				show: "Rawkode Live",
				startedAt: 123,
				startsAt: "2026-08-01T10:00:00.000Z",
				title: "Future event",
			},
		} satisfies StudioLiveState;

		expect(
			shouldMountStudioLiveGate({
				isLive: true,
				isUpcomingLive: false,
				liveState: activeLiveState,
				now,
				publishedAt: new Date("2026-08-01T10:00:00.000Z"),
			}),
		).toBe(true);
		expect(
			shouldMountStudioLiveGate({
				isLive: true,
				isUpcomingLive: true,
				liveState: inactiveLiveState,
				now,
				publishedAt: new Date("2026-08-01T13:00:00.000Z"),
			}),
		).toBe(true);
		expect(
			shouldMountStudioLiveGate({
				isLive: true,
				isUpcomingLive: false,
				liveState: inactiveLiveState,
				now,
				publishedAt: new Date("2026-08-01T10:30:00.000Z"),
			}),
		).toBe(true);
		expect(
			shouldMountStudioLiveGate({
				isLive: true,
				isUpcomingLive: false,
				liveState: inactiveLiveState,
				now,
				publishedAt: new Date("2026-08-01T10:00:00.000Z"),
			}),
		).toBe(true);
		expect(
			shouldMountStudioLiveGate({
				isLive: true,
				isUpcomingLive: false,
				liveState: inactiveLiveState,
				now,
				publishedAt: new Date("2026-08-01T07:00:00.000Z"),
			}),
		).toBe(false);
		expect(
			shouldMountStudioLiveGate({
				isLive: false,
				isUpcomingLive: false,
				liveState: activeLiveState,
				now,
				publishedAt: new Date("2026-08-01T10:00:00.000Z"),
			}),
		).toBe(false);
	});

	it("keeps the watch page live branch separate from the VOD player", () => {
		const wrangler = JSON.parse(
			readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8"),
		) as { services?: Array<Record<string, string>> };
		const watchPage = readFileSync(
			join(process.cwd(), "src/pages/watch/[...slug].astro"),
			"utf8",
		);

		expect(wrangler.services).toContainEqual({
			binding: "STUDIO",
			service: "rawkode-academy-studio",
		});
		expect(watchPage).toContain("getStudioLiveState(env as StudioBindingEnv");
		expect(watchPage).toContain("video.data.slug");
		expect(watchPage).toContain("shouldMountStudioLiveGate");
		expect(watchPage).toContain(
			'Astro.response.headers.set("Cache-Control", "no-store")',
		);
		expect(watchPage).toContain("<LiveStreamGate");
		expect(watchPage).toContain("fallbackVideoId");
		expect(watchPage).toContain("<VideoPlayer");
	});
});

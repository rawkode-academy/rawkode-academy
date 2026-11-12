import { describe, expect, it, vi } from "vitest";
import { parseArgs, parseSince } from "../scripts/trigger_missing";
import {
	DEFAULT_API_URL,
	discoverThumbnailJobs,
	thumbnailUrl,
	thumbnailVideosQuery,
} from "../scripts/videos";

const videos = [
	{
		id: "ki0qbn121pdjly5f5vtvii1m",
		tagline: "Peer-to-peer apps, built from first principles",
		updatedAt: "2026-07-01T00:00:00.000Z",
		technologies: [
			{
				id: "iroh",
				name: "Iroh",
				icon: "https://content.rawkode.academy/technologies/iroh/icon.svg",
				terms: ["Iroh", "peer-to-peer"],
			},
		],
	},
	{
		id: "elpqrlouhe220jyf5tqr65vm",
		tagline: "Kubernetes-native job queueing, hands-on",
		updatedAt: "2026-07-20T12:00:00.000Z",
		technologies: [
			{
				id: "kueue",
				name: "Kueue",
				icon: "https://content.rawkode.academy/technologies/kueue/icon.svg",
				terms: ["ClusterQueue"],
			},
			{
				id: "kubernetes",
				name: "Kubernetes",
				icon: "https://content.rawkode.academy/technologies/kubernetes/icon.svg",
				terms: ["K8s"],
			},
		],
	},
	{ id: "notech", tagline: null, updatedAt: null, technologies: [] },
	{
		id: "noicon",
		tagline: null,
		updatedAt: null,
		technologies: [{ id: "mystery", name: "Mystery", icon: null, terms: null }],
	},
];

function mockFetcher(body: unknown, init: ResponseInit = { status: 200 }) {
	return vi.fn(
		async (_input: RequestInfo | URL, _init?: RequestInit) =>
			new Response(JSON.stringify(body), init),
	);
}

describe("video discovery", () => {
	it("queries the gateway for every video", async () => {
		const fetcher = mockFetcher({ data: { getAllVideos: [] } });
		await discoverThumbnailJobs({
			commitSha: "test-sha",
			fetcher: fetcher as unknown as typeof fetch,
		});

		expect(fetcher).toHaveBeenCalledOnce();
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe(DEFAULT_API_URL);
		expect(init?.method).toBe("POST");
		expect(JSON.parse(String(init?.body))).toEqual({
			query: thumbnailVideosQuery(),
		});
	});

	it("only requests updatedAt when forcing recently updated videos", async () => {
		const fetcher = mockFetcher({ data: { getAllVideos: [] } });
		await discoverThumbnailJobs({
			commitSha: "test-sha",
			fetcher: fetcher as unknown as typeof fetch,
		});
		await discoverThumbnailJobs({
			commitSha: "test-sha",
			forceUpdatedSince: new Date(0),
			fetcher: fetcher as unknown as typeof fetch,
		});

		const queries = fetcher.mock.calls.map(
			([, init]) => JSON.parse(String(init?.body)).query as string,
		);
		expect(queries[0]).not.toContain("updatedAt");
		expect(queries[1]).toContain("updatedAt");
	});

	it("builds jobs from the primary technology", async () => {
		const { jobs, skipped } = await discoverThumbnailJobs({
			commitSha: "test-sha",
			fetcher: mockFetcher({
				data: { getAllVideos: videos },
			}) as unknown as typeof fetch,
		});

		expect(jobs).toEqual([
			{
				videoId: "ki0qbn121pdjly5f5vtvii1m",
				tagline: "Peer-to-peer apps, built from first principles",
				technology: {
					id: "iroh",
					name: "Iroh",
					iconUrl: "https://content.rawkode.academy/technologies/iroh/icon.svg",
					terms: ["Iroh", "peer-to-peer"],
				},
				source: { commitSha: "test-sha", trigger: "github-actions" },
				force: undefined,
			},
			{
				videoId: "elpqrlouhe220jyf5tqr65vm",
				tagline: "Kubernetes-native job queueing, hands-on",
				technology: {
					id: "kueue",
					name: "Kueue",
					iconUrl:
						"https://content.rawkode.academy/technologies/kueue/icon.svg",
					terms: ["ClusterQueue"],
				},
				source: { commitSha: "test-sha", trigger: "github-actions" },
				force: undefined,
			},
		]);
		expect(skipped).toEqual([
			{ videoId: "notech", reason: "missing primary technology" },
			{ videoId: "noicon", reason: "missing technology icon for mystery" },
		]);
	});

	it("forces videos updated since the given instant", async () => {
		const { jobs } = await discoverThumbnailJobs({
			commitSha: "test-sha",
			forceUpdatedSince: new Date("2026-07-10T00:00:00.000Z"),
			fetcher: mockFetcher({
				data: { getAllVideos: videos },
			}) as unknown as typeof fetch,
		});

		expect(jobs.map((job) => [job.videoId, job.force])).toEqual([
			["ki0qbn121pdjly5f5vtvii1m", undefined],
			["elpqrlouhe220jyf5tqr65vm", true],
		]);
	});

	it("forces every job with force", async () => {
		const { jobs } = await discoverThumbnailJobs({
			commitSha: "test-sha",
			force: true,
			fetcher: mockFetcher({
				data: { getAllVideos: videos },
			}) as unknown as typeof fetch,
		});

		expect(jobs.every((job) => job.force === true)).toBe(true);
	});

	it("surfaces HTTP and GraphQL errors", async () => {
		await expect(
			discoverThumbnailJobs({
				commitSha: "test-sha",
				fetcher: mockFetcher(
					{},
					{ status: 502, statusText: "Bad Gateway" },
				) as unknown as typeof fetch,
			}),
		).rejects.toThrow("502 Bad Gateway");

		await expect(
			discoverThumbnailJobs({
				commitSha: "test-sha",
				fetcher: mockFetcher({
					errors: [{ message: "boom" }],
				}) as unknown as typeof fetch,
			}),
		).rejects.toThrow("boom");
	});

	it("builds canonical public thumbnail URLs", () => {
		expect(thumbnailUrl("abc123")).toBe(
			"https://content.rawkode.academy/videos/abc123/thumbnail.webp",
		);
	});
});

describe("trigger CLI", () => {
	it("parses defaults and flags", () => {
		expect(parseArgs(["bun", "script"])).toMatchObject({
			concurrency: 10,
			dryRun: false,
			force: false,
			forceUpdatedSince: undefined,
		});
		expect(
			parseArgs([
				"bun",
				"script",
				"--dry-run",
				"--force",
				"--force-updated-since",
				"2026-07-10T00:00:00Z",
				"--api-url",
				"http://localhost:4000/",
				"--concurrency",
				"2",
				"--max",
				"5",
				"--video-id",
				"abc123",
				"--video-id",
				"def456",
			]),
		).toMatchObject({
			apiUrl: "http://localhost:4000/",
			concurrency: 2,
			dryRun: true,
			force: true,
			forceUpdatedSince: new Date("2026-07-10T00:00:00Z"),
			max: 5,
			videoIds: ["abc123", "def456"],
		});
	});

	it("parses relative durations for --force-updated-since", () => {
		const now = Date.parse("2026-07-10T12:00:00Z");
		expect(parseSince("6h", now).toISOString()).toBe(
			"2026-07-10T06:00:00.000Z",
		);
		expect(parseSince("2d", now).toISOString()).toBe(
			"2026-07-08T12:00:00.000Z",
		);
		expect(parseSince("30m", now).toISOString()).toBe(
			"2026-07-10T11:30:00.000Z",
		);
	});
});

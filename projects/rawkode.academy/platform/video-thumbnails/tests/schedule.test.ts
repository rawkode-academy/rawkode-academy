import { describe, expect, it } from "vitest";
import type { ThumbnailWorkflowParams } from "../src/contracts";
import {
	MAX_SCHEDULED_JOBS,
	scheduleMissingThumbnails,
} from "../src/schedule";

const video = (id: string, icon: string | null = `https://cdn/${id}.svg`) => ({
	id,
	tagline: `${id} tagline`,
	technologies: [{ id: `tech-${id}`, name: `Tech ${id}`, icon, terms: [] }],
});

function fakeEnv(videos: unknown[], existing: string[] = []) {
	const created: ThumbnailWorkflowParams[] = [];
	const requests: string[] = [];
	const env = {
		API: {
			fetch: async (input: RequestInfo | URL) => {
				requests.push(String(input));
				return Response.json({ data: { getAllVideos: videos } });
			},
		} as unknown as Fetcher,
		CONTENT_BUCKET: {
			head: async (key: string) => (existing.includes(key) ? {} : null),
		} as unknown as R2Bucket,
		GENERATE_VIDEO_THUMBNAIL: {
			create: async (options: { params: ThumbnailWorkflowParams }) => {
				created.push(options.params);
				return { id: `instance-${created.length}` };
			},
		} as unknown as Workflow<ThumbnailWorkflowParams>,
	};
	return { env, created, requests };
}

describe("scheduleMissingThumbnails", () => {
	it("starts a workflow only for videos without a thumbnail", async () => {
		const { env, created, requests } = fakeEnv(
			[video("aaa"), video("bbb"), video("ccc", null)],
			["videos/aaa/thumbnail.webp"],
		);

		const result = await scheduleMissingThumbnails(env);

		expect(requests).toEqual(["https://api.rawkode.academy/"]);
		expect(result).toEqual({ discovered: 2, skipped: 1, started: ["bbb"] });
		expect(created).toHaveLength(1);
		expect(created[0]).toMatchObject({
			videoId: "bbb",
			technology: { id: "tech-bbb", iconUrl: "https://cdn/bbb.svg" },
			source: { commitSha: "scheduled", trigger: "scheduled" },
		});
	});

	it("caps the workflows one run starts", async () => {
		const videos = Array.from({ length: MAX_SCHEDULED_JOBS + 10 }, (_, i) =>
			video(`v${i}`),
		);
		const { env, created } = fakeEnv(videos);

		const result = await scheduleMissingThumbnails(env);

		expect(created).toHaveLength(MAX_SCHEDULED_JOBS);
		expect(result.started).toHaveLength(MAX_SCHEDULED_JOBS);
	});

	it("starts nothing when every thumbnail exists", async () => {
		const { env, created } = fakeEnv(
			[video("aaa"), video("bbb")],
			["videos/aaa/thumbnail.webp", "videos/bbb/thumbnail.webp"],
		);

		const result = await scheduleMissingThumbnails(env);

		expect(created).toHaveLength(0);
		expect(result.started).toEqual([]);
	});
});

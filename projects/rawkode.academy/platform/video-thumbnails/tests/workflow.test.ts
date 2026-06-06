import { describe, expect, it } from "vitest";
import type {
	ThumbnailRenderParams,
	ThumbnailWorkflowParams,
} from "../src/contracts";
import {
	buildBackgroundPrompt,
	fetchVideoThumbnailDetails,
	generateAndStoreThumbnail,
	thumbnailExists,
} from "../src/generator";
import type { Env } from "../src/env";

class FakeR2Bucket {
	heads = new Map<string, unknown>();
	puts = new Map<string, { value: Uint8Array; options: R2PutOptions }>();

	async head(key: string) {
		return this.heads.get(key) ?? null;
	}

	async put(
		key: string,
		value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null,
		options?: R2PutOptions,
	) {
		const bytes = value instanceof Uint8Array
			? value
			: typeof value === "string"
				? new TextEncoder().encode(value)
				: new Uint8Array(value as ArrayBuffer);
		this.puts.set(key, { value: bytes, options: options ?? {} });
		return null;
	}
}

class FakeBrowserRun {
	action?: string;
	options?: BrowserRunScreenshotOptions;

	constructor(private readonly response = new Response(new Uint8Array([1, 2, 3]), {
		headers: { "content-type": "image/webp" },
	})) {}

	async fetch() {
		throw new Error("Unexpected BrowserRun fetch call");
	}

	async quickAction(
		action: "screenshot",
		options: BrowserRunScreenshotOptions,
	): Promise<Response> {
		this.action = action;
		this.options = options;
		return this.response;
	}
}

function browserScreenshotHtml(options: BrowserRunScreenshotOptions | undefined): string {
	if (!options || !("html" in options)) return "";
	return options.html;
}

const params: ThumbnailWorkflowParams = {
	videoId: "video123",
	tagline: "Peer-to-peer apps, built from first principles",
	technology: {
		id: "iroh",
		name: "Iroh",
		iconSvg:
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#7c7cff" d="M0 0h10v10H0z"/></svg>',
		terms: ["peer-to-peer", "QUIC"],
	},
	source: {
		commitSha: "test-sha",
		trigger: "test",
	},
};

const renderParams: ThumbnailRenderParams = {
	video: {
		id: "video123",
		slug: "hands-on-introduction-to-iroh",
		title: "Hands-on Introduction to Iroh",
		tagline: "Peer-to-peer apps, built from first principles",
		description: "A hands-on introduction to Iroh.",
		publishedAt: "2026-07-09T17:00:00.000Z",
	},
	show: {
		id: "rawkode-live",
		name: "Rawkode Live",
		terms: ["hands-on", "developer livestream"],
	},
	technology: {
		id: "iroh",
		name: "Iroh",
		iconSvg:
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#7c7cff" d="M0 0h10v10H0z"/></svg>',
		terms: ["peer-to-peer", "QUIC"],
	},
	guests: [
		{
			id: "b5",
			name: "Brendan O'Brien",
			github: "b5",
			avatarUrl: "https://github.com/b5.png?size=512",
		},
	],
	source: {
		commitSha: "test-sha",
		trigger: "test",
	},
};

function graphqlVideoResponse() {
	return Response.json({
		data: {
			videoByID: {
				id: renderParams.video.id,
				slug: renderParams.video.slug,
				title: renderParams.video.title,
				description: renderParams.video.description,
				publishedAt: renderParams.video.publishedAt,
				terms: [],
				episode: {
					show: renderParams.show,
				},
				guests: [
					{
						id: "b5",
						name: "Brendan O'Brien",
						terms: [],
					},
				],
			},
		},
	});
}

function createEnv(
	bucket = new FakeR2Bucket(),
	browser = new FakeBrowserRun(),
): Env {
	return {
		AI: {
			run: async () => ({ image: btoa("fake-png") }),
		} as unknown as Ai,
		BROWSER: browser as unknown as BrowserRun,
		CONTENT_BUCKET: bucket as unknown as R2Bucket,
		GENERATE_VIDEO_THUMBNAIL: {} as Workflow<ThumbnailWorkflowParams>,
	};
}

describe("thumbnail workflow helpers", () => {
	it("builds technology-specific background prompts", () => {
		const prompt = buildBackgroundPrompt(renderParams);
		expect(prompt).toContain("Iroh");
		expect(prompt).toContain("peer-to-peer");
		expect(prompt).toContain("no letters");
		expect(prompt).toContain("no UI screenshots");
	});

	it("skips existing thumbnails unless forced", async () => {
		const bucket = new FakeR2Bucket();
		bucket.heads.set("videos/video123/thumbnail.webp", {});
		const env = createEnv(bucket);

		expect(await thumbnailExists(env, params)).toBe(true);
		expect(await thumbnailExists(env, { ...params, force: true })).toBe(false);
	});

	it("fetches dynamic video thumbnail details from GraphQL", async () => {
		let requestBody: Record<string, unknown> | undefined;
		const details = await fetchVideoThumbnailDetails(
			params,
			async (input, init) => {
				expect(String(input)).toBe("https://api.rawkode.academy");
				requestBody = JSON.parse(String(init?.body));
				return graphqlVideoResponse();
			},
		);

		expect(requestBody).toMatchObject({ variables: { id: "video123" } });
		expect(details).toMatchObject({
			video: {
				id: "video123",
				title: "Hands-on Introduction to Iroh",
				tagline: "Peer-to-peer apps, built from first principles",
			},
			show: {
				name: "Rawkode Live",
			},
			technology: {
				id: "iroh",
				iconSvg: params.technology.iconSvg,
			},
			guests: [
				{
					github: "b5",
					avatarUrl: "https://github.com/b5.png?size=512",
				},
			],
		});
	});

	it("fails clearly when GraphQL cannot resolve video details", async () => {
		await expect(
			fetchVideoThumbnailDetails(params, async () =>
				Response.json({
					errors: [{ message: "video not found" }],
				})
			),
		).rejects.toThrow("GraphQL failed to fetch video details for video123");
	});

	it("generates HTML, captures WebP, and writes the canonical R2 object", async () => {
		const bucket = new FakeR2Bucket();
		const browser = new FakeBrowserRun();
		const env = createEnv(bucket, browser);

		const result = await generateAndStoreThumbnail(env, params, {
			fetch: async (input) => {
				const url = String(input);
				if (url === "https://api.rawkode.academy") return graphqlVideoResponse();

				throw new Error(`Unexpected fetch: ${url}`);
			},
		});

		expect(result).toEqual({
			key: "videos/video123/thumbnail.webp",
			size: 3,
		});
		expect(browser.action).toBe("screenshot");
		const html = browserScreenshotHtml(browser.options);
		expect(html).toContain("Rawkode Live");
		expect(html).toContain("Peer-to-peer apps, built from first principles");
		expect(html).not.toContain("Hands-on Introduction to Iroh");
		expect(html).toContain("Rawkode Academy");
		expect(html).toContain("https://github.com/b5.png?size=512");
		expect(browser.options?.screenshotOptions).toMatchObject({ type: "webp" });

		const put = bucket.puts.get("videos/video123/thumbnail.webp");
		expect(put?.value).toEqual(new Uint8Array([1, 2, 3]));
		expect(put?.options.httpMetadata).toMatchObject({
			contentType: "image/webp",
			cacheControl: "public, max-age=31536000, immutable",
		});
		expect(put?.options.customMetadata).toMatchObject({
			commitSha: "test-sha",
			source: "test",
			technology: "iroh",
		});
	});

	it("fails clearly when Workers AI does not return an image", async () => {
		const env = createEnv();
		env.AI = {
			run: async () => ({}),
		} as unknown as Ai;

		await expect(
			generateAndStoreThumbnail(env, params, {
				fetch: async (input) => {
					const url = String(input);
					if (url === "https://api.rawkode.academy") return graphqlVideoResponse();
					throw new Error(`Unexpected fetch: ${url}`);
				},
			}),
		).rejects.toThrow("Workers AI did not return a generated image");
	});

	it("fails clearly when Browser Rendering fails", async () => {
		const env = createEnv(
			new FakeR2Bucket(),
			new FakeBrowserRun(new Response("nope", {
				status: 500,
				statusText: "Internal Error",
			})),
		);

		await expect(
			generateAndStoreThumbnail(env, params, {
				fetch: async (input) => {
					const url = String(input);
					if (url === "https://api.rawkode.academy") return graphqlVideoResponse();
					throw new Error(`Unexpected fetch: ${url}`);
				},
			}),
		).rejects.toThrow("Browser Rendering screenshot failed");
	});
});

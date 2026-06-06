import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_CACHE_TTL_SECONDS, getContentCachePolicy } from "./cache-policy";
import { handleContentRequest } from "./content-handler";
import { isPublicContentKey } from "./public-key-policy";

let fakeCache: FakeCache;

beforeEach(() => {
	fakeCache = new FakeCache();
	Object.defineProperty(globalThis, "caches", {
		configurable: true,
		value: {
			default: fakeCache,
			open: async () => fakeCache,
		},
	});
});

afterEach(() => {
	Reflect.deleteProperty(globalThis, "caches");
});

describe("content public key policy", () => {
	it("keeps VOD outputs public", () => {
		expect(isPublicContentKey("videos/video-123/stream.m3u8")).toBe(true);
		expect(isPublicContentKey("videos/video-123/original.mp3")).toBe(true);
		expect(isPublicContentKey("videos/video-123/thumbnail.webp")).toBe(true);
		expect(isPublicContentKey("videos/video-123/transcode-status.json")).toBe(
			true,
		);
	});

	it("does not expose Studio recording source objects or ready markers", () => {
		expect(
			isPublicContentKey("studio/recordings/session-1/recording-1/source.webm"),
		).toBe(false);
		expect(
			isPublicContentKey("studio/recordings/session-1/recording-1/ready.json"),
		).toBe(false);
		expect(
			isPublicContentKey(
				"studio/recordings/session-1/recording-1/transcode-status.json",
			),
		).toBe(false);
	});
});

describe("content cache policy", () => {
	it("uses sensible TTLs by object type", () => {
		expect(getContentCachePolicy("videos/video-123/thumbnail.webp")).toEqual({
			cacheControl: "public, max-age=3600, s-maxage=3600",
			cacheable: true,
		});
		expect(
			getContentCachePolicy("videos/video-123/transcode-status.json"),
		).toEqual({
			cacheControl: "no-store",
			cacheable: false,
		});
		expect(getContentCachePolicy("videos/video-123/stream.m3u8")).toEqual({
			cacheControl: "public, max-age=300, s-maxage=3600",
			cacheable: true,
		});
		expect(getContentCachePolicy("videos/video-123/captions/en.vtt")).toEqual({
			cacheControl: "public, max-age=86400, s-maxage=86400",
			cacheable: true,
		});
		expect(getContentCachePolicy("videos/video-123/720p/0001.ts")).toEqual({
			cacheControl: "public, max-age=86400, s-maxage=86400",
			cacheable: true,
		});
	});

	it("never configures a cache directive above 24 hours", () => {
		const policies = [
			getContentCachePolicy("videos/video-123/thumbnail.webp"),
			getContentCachePolicy("videos/video-123/transcode-status.json"),
			getContentCachePolicy("videos/video-123/stream.m3u8"),
			getContentCachePolicy("videos/video-123/captions/en.vtt"),
			getContentCachePolicy("videos/video-123/original.mp3"),
			getContentCachePolicy("videos/video-123/unknown.bin"),
		];

		for (const policy of policies) {
			expect(policy.cacheControl).not.toContain("immutable");
			expect(policy.cacheControl).not.toContain("stale-if-error");
			expect(policy.cacheControl).not.toContain("stale-while-revalidate");

			const matches = policy.cacheControl.matchAll(
				/(?:^|,\s*)(?:max-age|s-maxage)=(\d+)/g,
			);
			for (const match of matches) {
				expect(Number.parseInt(match[1], 10)).toBeLessThanOrEqual(
					MAX_CACHE_TTL_SECONDS,
				);
			}
		}
	});
});

describe("content request handler cache behavior", () => {
	it("caches full thumbnail GET responses at the edge", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/thumbnail.webp", "thumbnail"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };
		const waitUntil: Promise<unknown>[] = [];
		const request = new Request(
			"https://content.rawkode.academy/videos/video-123/thumbnail.webp",
		);

		const first = await handleContentRequest(env, request, {
			waitUntil: (promise) => waitUntil.push(promise),
		});
		await Promise.all(waitUntil);

		expect(first.headers.get("cache-control")).toBe(
			"public, max-age=3600, s-maxage=3600",
		);
		expect(await first.text()).toBe("thumbnail");
		expect(bucket.getCalls).toHaveLength(1);
		expect(fakeCache.puts).toHaveLength(1);

		const second = await handleContentRequest(env, request);

		expect(await second.text()).toBe("thumbnail");
		expect(bucket.getCalls).toHaveLength(1);
		expect(fakeCache.matches).toHaveLength(2);
	});

	it("does not cache transcode status documents", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/transcode-status.json", "{}"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };

		const response = await handleContentRequest(
			env,
			new Request(
				"https://content.rawkode.academy/videos/video-123/transcode-status.json",
			),
		);

		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(fakeCache.matches).toHaveLength(0);
		expect(fakeCache.puts).toHaveLength(0);
	});

	it("uses short browser TTLs for HLS manifests", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/stream.m3u8", "#EXTM3U"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };

		const response = await handleContentRequest(
			env,
			new Request(
				"https://content.rawkode.academy/videos/video-123/stream.m3u8",
			),
		);

		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=300, s-maxage=3600",
		);
	});

	it("keeps stable media TTLs capped at 24 hours", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/original.mp3", "audio"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };

		const response = await handleContentRequest(
			env,
			new Request(
				"https://content.rawkode.academy/videos/video-123/original.mp3",
			),
		);

		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=86400, s-maxage=86400",
		);
	});

	it("tracks original mp3 downloads on cache misses and hits", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/original.mp3", "audio"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };
		const tracked: string[] = [];
		const waitUntil: Promise<unknown>[] = [];
		const options = {
			trackDownload: async (videoId: string) => {
				tracked.push(videoId);
			},
			waitUntil: (promise: Promise<unknown>) => waitUntil.push(promise),
		};
		const request = new Request(
			"https://content.rawkode.academy/videos/video-123/original.mp3",
		);

		await handleContentRequest(env, request, options);
		await Promise.all(waitUntil);
		waitUntil.length = 0;

		await handleContentRequest(env, request, options);
		await Promise.all(waitUntil);

		expect(bucket.getCalls).toHaveLength(1);
		expect(tracked).toEqual(["video-123", "video-123"]);
	});

	it("does not cache range requests", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/720p/0001.ts", "segment-body"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };

		const response = await handleContentRequest(
			env,
			new Request(
				"https://content.rawkode.academy/videos/video-123/720p/0001.ts",
				{
					headers: { Range: "bytes=0-3" },
				},
			),
		);

		expect(response.status).toBe(206);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=86400, s-maxage=86400",
		);
		expect(response.headers.get("content-range")).toBe("bytes 0-3/12");
		expect(await response.text()).toBe("segm");
		expect(fakeCache.matches).toHaveLength(0);
		expect(fakeCache.puts).toHaveLength(0);
	});

	it("applies cache policy to HEAD responses without using Cache API", async () => {
		const bucket = new FakeR2Bucket([
			["videos/video-123/thumbnail.webp", "thumbnail"],
		]);
		const env = { CONTENT_BUCKET: bucket as unknown as R2Bucket };

		const response = await handleContentRequest(
			env,
			new Request(
				"https://content.rawkode.academy/videos/video-123/thumbnail.webp",
				{
					method: "HEAD",
				},
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=3600, s-maxage=3600",
		);
		expect(response.headers.get("content-length")).toBe("9");
		expect(fakeCache.matches).toHaveLength(0);
		expect(fakeCache.puts).toHaveLength(0);
	});
});

class FakeCache {
	readonly matches: string[] = [];
	readonly puts: string[] = [];
	private readonly responses = new Map<string, Response>();

	async match(request: RequestInfo | URL): Promise<Response | undefined> {
		const key = cacheKey(request);
		this.matches.push(key);
		return this.responses.get(key)?.clone();
	}

	async put(request: RequestInfo | URL, response: Response): Promise<void> {
		const key = cacheKey(request);
		this.puts.push(key);
		this.responses.set(key, response.clone());
	}
}

class FakeR2Bucket {
	readonly getCalls: Array<{
		key: string;
		options?: R2GetOptions;
	}> = [];
	readonly headCalls: string[] = [];
	private readonly objects: Map<string, string>;

	constructor(objects: Array<[string, string]>) {
		this.objects = new Map(objects);
	}

	async head(key: string): Promise<R2Object | null> {
		this.headCalls.push(key);
		const value = this.objects.get(key);
		if (value === undefined) return null;
		return new FakeR2Object(key, value) as unknown as R2Object;
	}

	async get(
		key: string,
		options?: R2GetOptions,
	): Promise<R2ObjectBody | R2Object | null> {
		this.getCalls.push({ key, options });
		const value = this.objects.get(key);
		if (value === undefined) return null;
		return new FakeR2Object(
			key,
			value,
			options?.range,
		) as unknown as R2ObjectBody;
	}
}

class FakeR2Object {
	readonly httpEtag = '"test-etag"';
	readonly range?: R2Range;
	readonly size: number;

	constructor(
		readonly key: string,
		private readonly value: string,
		range?: R2Range,
	) {
		this.range = range;
		this.size = value.length;
	}

	get body(): ReadableStream {
		const value =
			this.range && "offset" in this.range
				? this.value.slice(
						this.range.offset,
						this.range.offset + this.range.length,
					)
				: this.value;
		return new Response(value).body as ReadableStream;
	}

	writeHttpMetadata(headers: Headers): void {
		headers.set("content-type", contentTypeForKey(this.key));
		headers.set("cache-control", "public, max-age=31536000, immutable");
	}
}

function contentTypeForKey(key: string): string {
	if (key.endsWith(".webp")) return "image/webp";
	if (key.endsWith(".json")) return "application/json";
	if (key.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
	if (key.endsWith(".mp3")) return "audio/mpeg";
	return "application/octet-stream";
}

function cacheKey(request: RequestInfo | URL): string {
	if (request instanceof Request) return request.url;
	if (request instanceof URL) return request.toString();
	return request;
}

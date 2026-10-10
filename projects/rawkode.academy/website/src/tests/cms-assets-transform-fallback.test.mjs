import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../pages/cms-assets/[assetId].ts";

test("Cloudflare Images transform failures return an uncached original image", async () => {
	const checksum = "a".repeat(64);
	let cacheReads = 0;
	let cacheWrites = 0;
	const previousCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
	Object.defineProperty(globalThis, "caches", {
		configurable: true,
		value: {
			default: {
				match: async (key) => {
					cacheReads += 1;
					return undefined;
				},
				put: async () => {
					cacheWrites += 1;
				},
			},
		},
	});

	try {
		const response = await GET({
			params: { assetId: "asset-test-id" },
			url: new URL(
				`https://academy.test/cms-assets/asset-test-id?v=${checksum}&w=640`,
			),
			request: new Request(
				`https://academy.test/cms-assets/asset-test-id?v=${checksum}&w=640`,
			),
			locals: {
				runtime: {
					env: {
						PAYLOAD_CONTENT: {
							fetch: async () =>
								new Response("original jpeg", {
									headers: {
										"Content-Type": "image/jpeg",
										"X-Content-Checksum": checksum,
									},
								}),
						},
						IMAGES: {
							input: () => ({
								transform: () => ({
									output: async () => {
										throw new Error("temporary transform failure");
									},
								}),
							}),
						},
					},
				},
			},
		});

		assert.equal(response.status, 200);
		assert.equal(await response.text(), "original jpeg");
		assert.equal(response.headers.get("Content-Type"), "image/jpeg");
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
		assert.equal(response.headers.get("X-Image-Transform"), "fallback");
		assert.equal(cacheReads, 1);
		assert.equal(cacheWrites, 0);
	} finally {
		if (previousCaches) {
			Object.defineProperty(globalThis, "caches", previousCaches);
		} else {
			delete globalThis.caches;
		}
	}
});

test("missing Cloudflare Images binding returns an uncached original raster", async () => {
	const checksum = "b".repeat(64);
	let cacheWrites = 0;
	const previousCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
	Object.defineProperty(globalThis, "caches", {
		configurable: true,
		value: {
			default: {
				match: async () => undefined,
				put: async () => {
					cacheWrites += 1;
				},
			},
		},
	});

	try {
		const url = `https://academy.test/cms-assets/asset-test-id?v=${checksum}&w=640`;
		const response = await GET({
			params: { assetId: "asset-test-id" },
			url: new URL(url),
			request: new Request(url),
			locals: {
				runtime: {
					env: {
						PAYLOAD_CONTENT: {
							fetch: async () =>
								new Response("original jpeg", {
									headers: {
									"Content-Type": "image/jpeg",
									"X-Content-Checksum": checksum,
								},
								}),
						},
					},
				},
			},
		});

		assert.equal(response.status, 200);
		assert.equal(await response.text(), "original jpeg");
		assert.equal(response.headers.get("Content-Type"), "image/jpeg");
		assert.equal(response.headers.get("Cache-Control"), "no-store");
		assert.equal(response.headers.get("CDN-Cache-Control"), "no-store");
		assert.equal(response.headers.get("X-Image-Transform"), "unavailable");
		assert.equal(cacheWrites, 0);
	} finally {
		if (previousCaches) {
			Object.defineProperty(globalThis, "caches", previousCaches);
		} else {
			delete globalThis.caches;
		}
	}
});

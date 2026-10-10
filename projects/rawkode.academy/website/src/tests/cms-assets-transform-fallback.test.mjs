import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../pages/cms-assets/[assetId].ts";

test("Cloudflare Images transform failures return an uncached original image", async () => {
	const checksum = "a".repeat(64);
	const cacheKeys = [];
	let cacheWrites = 0;
	const previousCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
	Object.defineProperty(globalThis, "caches", {
		configurable: true,
		value: {
			default: {
				match: async (key) => {
					cacheKeys.push(key.url);
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
		assert.equal(cacheWrites, 0);
		assert.match(cacheKeys[0], /cms-asset-cache-v2\.rawkode\.academy/);
	} finally {
		if (previousCaches) {
			Object.defineProperty(globalThis, "caches", previousCaches);
		} else {
			delete globalThis.caches;
		}
	}
});

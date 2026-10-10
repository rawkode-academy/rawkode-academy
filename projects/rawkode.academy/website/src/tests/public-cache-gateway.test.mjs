import assert from "node:assert/strict";
import test from "node:test";
import { cachedAstroProps, canUseCachedAstro } from "../lib/public-cache-gateway.ts";

const request = (path, init) => new Request(`https://preview.example${path}`, init);

test("the public cache gateway allows anonymous SSR and checks bypasses before cache routing", () => {
	assert.equal(canUseCachedAstro(request("/watch")), true);
	assert.equal(canUseCachedAstro(request("/watch?q=cloud&after=video")), true);
	assert.equal(canUseCachedAstro(request("/watch", { method: "HEAD" })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { cookie: "session=private" } })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { authorization: "Bearer secret" } })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { "cf-access-jwt-assertion": "identity" } })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { range: "bytes=0-10" } })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { "if-none-match": '"etag"' } })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { "cache-control": "no-store" } })), false);
	assert.equal(canUseCachedAstro(request("/watch", { headers: { "x-original-url": "/home" } })), false);
	assert.equal(canUseCachedAstro(request("/home")), false);
	assert.equal(canUseCachedAstro(request("/api/comments/video")), false);
	assert.equal(canUseCachedAstro(request("/__cms-preview-check")), false);
	assert.equal(canUseCachedAstro(request("/_astro/site.css")), false);
	assert.equal(canUseCachedAstro(request("/site.svg")), false);
	assert.equal(canUseCachedAstro(request("/watch"), false), false);
});

test("immutable CMS image and diagram Worker routes can reach native Workers Cache", () => {
	assert.equal(canUseCachedAstro(request("/cms-assets/asset_cuid2?v=abc123&w=640")), true);
	assert.equal(canUseCachedAstro(request(`/cms-diagrams/${"a".repeat(64)}.svg`)), true);
	assert.equal(canUseCachedAstro(request(`/cms-diagrams/${"g".repeat(64)}.svg`)), false);
	assert.equal(canUseCachedAstro(request("/cms-assets/private.svg")), false);
});

test("native cache props partition the Worker cache by normalized request host", () => {
	assert.deepEqual(cachedAstroProps(request("/watch")), { host: "preview.example" });
	assert.deepEqual(cachedAstroProps(new Request("https://RAWKODE.ACADEMY/watch")), { host: "rawkode.academy" });
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transform } from "@astrojs/compiler";

const source = readFileSync(
	new URL("../components/news/NewsSubscribeCard.astro", import.meta.url),
	"utf8",
);
assert.deepEqual((await transform(source)).diagnostics, []);

test("News delegates signup to the shared newsletter actions", () => {
	assert.match(
		source,
		/import NewsletterCTA from "@\/components\/newsletter\/NewsletterCTA\.astro"/,
	);
	assert.match(source, /<NewsletterCTA/);
	assert.match(source, /audience="news"/);
	assert.doesNotMatch(source, /email\.rawkode\.academy\/subscribe/);
});

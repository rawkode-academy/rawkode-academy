import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transform } from "@astrojs/compiler";

const source = readFileSync(
	new URL("../components/news/NewsSubscribeCard.astro", import.meta.url),
	"utf8",
);
const compiled = await transform(source);
assert.deepEqual(compiled.diagnostics, []);

test("News delegates signup to the shared newsletter action component", () => {
	assert.match(source, /<NewsletterCTA/);
	assert.match(source, /audience="news"/);
	assert.match(source, /headline="Cloud native tutorials and news by email"/);
	assert.doesNotMatch(source, /email\.rawkode\.academy|<form\b/);
});

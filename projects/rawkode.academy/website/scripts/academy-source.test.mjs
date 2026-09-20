import assert from "node:assert/strict";
import test from "node:test";
import { getAstroRecipeSource } from "./academy-source.mjs";

test("keeps recipe declarations, attributes, and nested template expressions", async () => {
	const result = await getAstroRecipeSource(`---
const styles = academyLayout();
const example = "<script>";
---
<div class={styles.root}>{items.map(item => <a class:list={[styles.card, styles.missing]}>{styles.title}</a>)}</div>`);
	for (const expected of ["academyLayout()", '"<script>"', "styles.root", "styles.card", "styles.missing", "styles.title"]) assert.ok(result.includes(expected), expected);
});

for (const close of ["</script>", "</script >", "</script\n>"]) {
	test(`ignores client-script scopes with ${JSON.stringify(close)}`, async () => {
		const result = await getAstroRecipeSource(`---\nconst styles = academyLayout();\n---\n<div class={styles.root}/><script data-example=">">const styles = {}; styles.clientOnly;${close}<p class={styles.notice}/>`);
		assert.ok(result.includes("styles.root"));
		assert.ok(result.includes("styles.notice"));
		assert.ok(!result.includes("styles.clientOnly"));
	});
}

test("ignores prose, comments, and raw script text instead of stitching HTML together", async () => {
	const result = await getAstroRecipeSource(`---\nconst styles = academyLayout();\n---\n<!-- styles.comment --><p>styles.prose</p><script>const example = '<scr<script>ipt>'; styles.clientOnly;</script><div class={styles.root}/>`);
	assert.ok(result.includes("styles.root"));
	for (const excluded of ["styles.comment", "styles.prose", "styles.clientOnly", "<scr"]) assert.ok(!result.includes(excluded));
});

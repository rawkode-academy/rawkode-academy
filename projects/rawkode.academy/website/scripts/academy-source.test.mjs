import assert from "node:assert/strict";
import test from "node:test";
import { getAstroRecipeSource, getRecipeUsage } from "./academy-source.mjs";

const recipeImport =
	'import { academyLayout } from "@rawkodeacademy/design-system";';
const slots = (usage) => usage.accesses.map((access) => access.slot);

test("keeps recipe declarations, attributes, and nested template expressions", async () => {
	const result = await getAstroRecipeSource(`---
const styles = academyLayout();
const example = "<script>";
---
<div class={styles.root}>{items.map(item => <a class:list={[styles.card, styles.missing]}>{styles.title}</a>)}</div>`);
	for (const expected of [
		"academyLayout()",
		'"<script>"',
		"styles.root",
		"styles.card",
		"styles.missing",
		"styles.title",
	])
		assert.ok(result.includes(expected), expected);
});

for (const close of ["</script>", "</script >", "</script\n>"]) {
	test(`ignores client-script scopes with ${JSON.stringify(close)}`, async () => {
		const result = await getRecipeUsage(
			`---\n${recipeImport}\nconst styles = academyLayout();\n---\n<div class={styles.root}/><script data-example=">">const styles = {}; styles.clientOnly;${close}<p class={styles.notice}/>`,
			".astro",
		);
		assert.deepEqual(slots(result), ["root", "notice"]);
	});
}

test("ignores prose, comments, and raw script text instead of stitching HTML together", async () => {
	const result = await getRecipeUsage(
		`---\n${recipeImport}\nconst styles = academyLayout();\n---\n<!-- styles.comment --><p>styles.prose</p><script>const example = '<scr<script>ipt>'; styles.clientOnly;</script><div class={styles.root}/>`,
		".astro",
	);
	assert.deepEqual(slots(result), ["root"]);
});

test("ignores CSS imports, strings, regex literals, comments, and template-literal text", async () => {
	const usage = await getRecipeUsage(
		`---
${recipeImport}
import "@rawkodeacademy/design-system/styles.css";
const styles = academyLayout();
const quoted = "styles.quoted";
const regex = /styles.regex/;
// styles.lineComment
/* styles.blockComment; const fake = academyLayout(); fake.invalid; */
const example = \`styles.literal \${styles.root}\`;
---
<div title="styles.attribute" class={styles.root}>
  styles.prose
  {"styles.stringExpression"}
  {\`styles.literalExpression \${styles.title}\`}
</div>`,
		".astro",
	);
	assert.deepEqual(slots(usage), ["root", "root", "title"]);
	assert.deepEqual(
		usage.imports.map((item) => item.imported),
		["academyLayout"],
	);
});

test("keeps invalid accesses in nested Astro expressions, optional chains, and literal keys", async () => {
	const usage = await getRecipeUsage(
		`---
import { academyLayout as layout } from "@rawkodeacademy/design-system";
const styles = layout();
---
<div {...{ class: styles.root }}>
 {items.map(item => <a class:list={[styles.card, styles?.missing]}>
   {item.active ? <span class={styles["alsoMissing"]}>{styles.title}</span> : null}
 </a>)}
 {layout().directMissing}
 {styles[\`literalMissing\`]}
 {styles[dynamicKey]}
</div>`,
		".astro",
	);
	assert.deepEqual(slots(usage), [
		"root",
		"card",
		"missing",
		"alsoMissing",
		"title",
		"directMissing",
		"literalMissing",
	]);
	// Exercise the same failure predicate as the source guard, rather than
	// allowing a parser that merely stops reporting all accesses to pass.
	const declared = new Set(["root", "card", "title"]);
	assert.throws(() => {
		for (const access of usage.accesses) {
			assert.ok(
				declared.has(access.slot),
				`missing ${access.imported}.${access.slot} slot`,
			);
		}
	}, /missing academyLayout.missing slot/);
});

test("resolves actual lexical bindings instead of other objects with the same name", async () => {
	const usage = await getRecipeUsage(
		`${recipeImport}
const styles = academyLayout();
const alias = styles;
styles.root;
alias.title;
function local(styles: { localOnly: string }) { return styles.localOnly; }
function factory(academyLayout: () => { other: string }) { return academyLayout().other; }
const unrelated = { styles: { unrelated: true } };
unrelated.styles.unrelated;
{ const styles = { blockOnly: true }; styles.blockOnly; }
const markup = <div title="styles.string">styles.prose {styles.missing}</div>;
`,
		".tsx",
	);
	assert.deepEqual(slots(usage), ["root", "title", "missing"]);
});

test("only actual design-system imports establish recipe bindings", async () => {
	const usage = await getRecipeUsage(`
// import { fakeRecipe } from "@rawkodeacademy/design-system";
const example = 'import { otherRecipe } from "@rawkodeacademy/design-system"';
import { academyLayout } from "elsewhere";
const styles = academyLayout();
styles.missing;
`);
	assert.deepEqual(usage, { imports: [], accesses: [] });
});

test("handles HTML comments before elements in conditional branches without dropping accesses", async () => {
	const usage = await getRecipeUsage(
		`---
${recipeImport}
const styles = academyLayout();
const text = "<!-- styles.string -->";
---
<p>Unicode before comments: → ☁</p>
{active ? (
 <!-- styles.comment --><section class={styles.root}>{text}</section>
) : (
 <!-- other branch --><section class={styles.missing}/>
)}`,
		".astro",
	);
	assert.deepEqual(slots(usage), ["root", "missing"]);
});

test("keeps Vue directive and interpolation accesses without matching quoted attributes or prose", async () => {
	const usage = await getRecipeUsage(
		`<script setup lang="ts">
${recipeImport}
import "@rawkodeacademy/design-system/styles.css";
const styles = academyLayout();
const message = "styles.string";
</script>
<template>
 <!-- styles.comment -->
 <div title="styles.attribute" :class="[styles.root, styles?.missing]">
   styles.prose {{ message }} {{ styles['title'] }}
   <span v-for="styles in [{ localOnly: 'x' }]" :class="styles.localOnly" />
 </div>
</template>
<style scoped>/* styles.styleComment */</style>`,
		".vue",
	);
	assert.deepEqual(slots(usage), ["root", "missing", "title"]);
});

test("fails closed on malformed JavaScript rather than silently losing accesses", async () => {
	await assert.rejects(() =>
		getRecipeUsage(
			`${recipeImport}\nconst styles = academyLayout(; styles.missing;`,
		),
	);
});

test("parses TypeScript generic functions without treating them as JSX", async () => {
	const usage = await getRecipeUsage(`${recipeImport}
const identity = <T>(value: T) => value;
const styles = academyLayout();
identity(styles.root);
`);
	assert.deepEqual(slots(usage), ["root"]);
});

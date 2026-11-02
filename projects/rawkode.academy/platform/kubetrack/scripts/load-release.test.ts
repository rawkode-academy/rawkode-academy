import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { exec, migratedD1 } from "../tests/d1";
import {
	type Bundle,
	parseBundle,
	readingMinutes,
	report,
	sentenceCount,
	toSql,
} from "./load-release";

const NOW = new Date("2026-10-01T00:00:00Z");

const FRONTMATTER = `---
id: "1.37"
title: Kubernetes v1.37
codename: Garhwal
releasedAt: 2026-08-26
publishedAt: 2026-11-16
summary: Every Kubernetes v1.37 enhancement explained, one card each, then a quiz.
releaseBlogUrl: https://kubernetes.io/blog/2026/08/26/kubernetes-v1-37-release/
changelogUrl: https://github.com/kubernetes/kubernetes/blob/master/CHANGELOG/CHANGELOG-1.37.md
upstreamCounts: { stable: 1, beta: 1, alpha: 0, deprecated: 0 }
---`;

const INTRO = "Kubernetes v1.37 ships **many** enhancements.";

const card = (
	kep: number,
	stage: string,
	options: {
		heading?: string;
		meta?: string;
		what?: string;
		why?: string | null;
		how?: string | null;
		example?: string | null;
	} = {},
) =>
	[
		options.heading ?? `## KEP-${kep} · ${stage} · sig-storage · Gate${kep}`,
		options.meta ??
			`title: Feature ${kep}\ngate-default: on\nprevious: alpha@1.35\ntheme: storage\ndocs: https://kubernetes.io/docs/${kep}/`,
		`What: ${options.what ?? `Feature ${kep} does one useful thing.`}`,
		"",
		options.why === null
			? ""
			: `### Why it matters\n\n${options.why ?? "It saves time."}\n`,
		options.how === null
			? ""
			: `### How to use it\n\n${options.how ?? "Turn on the gate."}\n`,
		options.example === null
			? ""
			: `### Example\n\n${options.example ?? "```yaml\napiVersion: v1\nkind: Pod\n```"}\n`,
	].join("\n");

const question = (
	id: string,
	kep: string,
	kind: string,
	choices = "- [ ] a First\n- [x] b Second\n- [ ] c Third",
	explanation = "> Because the second one is right.",
) =>
	`### ${id} · ${kep} · ${kind}\nWhich one is right?\n${choices}\n${explanation}\n`;

const TRUE_FALSE = "- [x] a True\n- [ ] b False";
const MULTIPLE = "- [x] a One\n- [x] b Two\n- [ ] c Three";

const bundle = (
	options: { cards?: string[]; questions?: string[]; front?: string } = {},
) =>
	[
		options.front ?? FRONTMATTER,
		INTRO,
		"",
		...(options.cards ?? [card(1710, "stable"), card(4639, "beta")]),
		"## Quiz",
		"",
		...(options.questions ?? [
			question("q01", "kep-1710", "single"),
			question("q02", "kep-4639", "multiple", MULTIPLE),
			question("q03", "kep-4639", "true_false", TRUE_FALSE),
		]),
	].join("\n");

const parse = (source: string) =>
	parseBundle(source, { file: "b.md", now: NOW });

const ok = (source: string): Bundle => {
	const result = parse(source);
	expect(result.errors).toEqual([]);
	if (!result.bundle) throw new Error("no bundle");
	return result.bundle;
};

const fails = (source: string, pattern: RegExp) => {
	const result = parse(source);
	expect(result.bundle).toBeNull();
	expect(result.errors.some((message) => pattern.test(message))).toBe(true);
	return result.errors;
};

describe("parseBundle", () => {
	it("maps a valid bundle to rows", () => {
		const { release, features, questions } = ok(bundle());
		expect(release).toMatchObject({
			id: "1.37",
			major: 1,
			minor: 37,
			title: "Kubernetes v1.37",
			codename: "Garhwal",
			releasedAt: new Date("2026-08-26T00:00:00Z"),
			publishedAt: new Date("2026-11-16T00:00:00Z"),
			upstreamCounts: { stable: 1, beta: 1, alpha: 0, deprecated: 0 },
		});
		expect(release.body.content?.[0]?.type).toBe("paragraph");

		expect(features.map((f) => [f.id, f.slug, f.stage, f.sortOrder])).toEqual([
			["1.37/kep-1710", "kep-1710", "stable", 1],
			["1.37/kep-4639", "kep-4639", "beta", 2],
		]);
		const [first] = features;
		expect(first).toMatchObject({
			kep: 1710,
			title: "Feature 1710",
			sig: "storage",
			theme: "storage",
			featureGate: "Gate1710",
			enabledByDefault: true,
			previousStage: "alpha",
			previousStageVersion: "1.35",
			summary: "Feature 1710 does one useful thing.",
			docsUrl: "https://kubernetes.io/docs/1710/",
		});
		const headings = first?.body.content
			?.filter((node) => node.type === "heading")
			.map((node) => JSON.stringify(node));
		expect(headings?.length).toBe(2);
		expect(headings?.[0]).toContain('"level":3');
		expect(first?.example?.content).toEqual([
			{
				type: "codeBlock",
				attrs: { language: "yaml", title: null, meta: null },
				content: [{ type: "text", text: "apiVersion: v1\nkind: Pod" }],
			},
		]);

		expect(
			questions.map((q) => [
				q.id,
				q.featureId,
				q.kind,
				q.answerIds,
				q.sortOrder,
			]),
		).toEqual([
			["1.37/q01", "1.37/kep-1710", "single", ["b"], 1],
			["1.37/q02", "1.37/kep-4639", "multiple", ["a", "b"], 2],
			["1.37/q03", "1.37/kep-4639", "true_false", ["a"], 3],
		]);
		expect(questions[0]?.choices).toEqual([
			{ id: "a", text: "First" },
			{ id: "b", text: "Second" },
			{ id: "c", text: "Third" },
		]);
		expect(questions[0]?.explanation.content?.[0]?.type).toBe("paragraph");
	});

	it("accepts the skill's optional fields being left out", () => {
		const { features, questions } = ok(
			bundle({
				cards: [
					card(1710, "stable", {
						heading: "## KEP-1710 · stable · node",
						meta: "title: No gate",
						example: null,
					}),
				],
				questions: [
					question("q01", "-", "single"),
					question("q02", "kep-1710", "single"),
				],
				front: FRONTMATTER.replace(/upstreamCounts.*\n/, ""),
			}),
		);
		expect(features[0]).toMatchObject({
			featureGate: null,
			enabledByDefault: null,
			previousStage: null,
			previousStageVersion: null,
			theme: null,
			docsUrl: null,
			example: null,
		});
		expect(questions[0]?.featureId).toBeNull();
	});

	it("keeps H2 headings before the first card in the intro", () => {
		const { release } = ok(
			bundle().replace(INTRO, `## About this release\n\n${INTRO}`),
		);
		expect(release.body.content?.[0]).toMatchObject({
			type: "heading",
			attrs: { level: 2 },
		});
	});

	it("ignores headings inside fenced code", () => {
		const { features } = ok(
			bundle({
				cards: [
					card(1710, "stable", {
						example:
							"```shell\n## not a card\n### not a section\nkubectl get pods\n```",
					}),
					card(4639, "beta"),
				],
			}),
		);
		expect(features).toHaveLength(2);
		expect(JSON.stringify(features[0]?.example)).toContain("## not a card");
	});

	it("strips HTML comments and warns about TODO markers", () => {
		const result = parse(
			bundle({
				cards: [
					card(1710, "stable", {
						why: "It saves time. <!-- TODO verify: the timing -->",
					}),
					card(4639, "beta"),
				],
			}),
		);
		expect(result.errors).toEqual([]);
		expect(
			result.warnings.some((w) => w.includes("TODO verify: the timing")),
		).toBe(true);
	});

	it("fails on an unclosed HTML comment instead of dropping the rest", () => {
		fails(
			bundle({
				questions: [
					question(
						"q01",
						"kep-1710",
						"single",
						undefined,
						"> Because. <!-- TODO",
					),
					question("q02", "kep-4639", "multiple", MULTIPLE),
				],
			}),
			/unclosed <!-- comment/,
		);
	});

	it("keeps Markdown hard line breaks", () => {
		const result = ok(
			bundle({
				cards: [
					card(1710, "stable", { why: "Line one  \nLine two" }),
					card(4639, "beta"),
				],
			}),
		);
		expect(JSON.stringify(result.features[0]?.body)).toContain("hardBreak");
	});

	it("tracks quiz prompt fences by their opening run", () => {
		const prompt = "~~~text\n```\n- [x] a not a choice\n~~~";
		const result = ok(
			bundle().replace(
				"### q01 · kep-1710 · single\nWhich one is right?",
				`### q01 · kep-1710 · single\nWhich one is right?\n${prompt}`,
			),
		);
		expect(result.questions[0]?.choices).toHaveLength(3);
	});

	it("accepts a 20-question quiz", () => {
		const questions = Array.from({ length: 20 }, (_, index) =>
			question(
				`q${String(index + 1).padStart(2, "0")}`,
				index % 2 === 0 ? "kep-1710" : "kep-4639",
				"single",
			),
		);
		expect(ok(bundle({ questions })).questions).toHaveLength(20);
	});
});

describe("lint", () => {
	it("fails on duplicate KEPs", () => {
		fails(
			bundle({ cards: [card(1710, "stable"), card(1710, "beta")] }),
			/duplicate KEP-1710/,
		);
	});

	it("fails when What is longer than 160 characters", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable", { what: `${"x".repeat(161)}.` }),
					card(4639, "beta"),
				],
			}),
			/What is 162 characters/,
		);
	});

	it("fails when What is more than one sentence", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable", { what: "It is fast. It is safe." }),
					card(4639, "beta"),
				],
			}),
			/What must be one sentence/,
		);
	});

	it("fails when What is missing", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable").replace(/^What:.*$/m, ""),
					card(4639, "beta"),
				],
			}),
			/"What:" is required/,
		);
	});

	it("fails without Why it matters", () => {
		fails(
			bundle({
				cards: [card(1710, "stable", { why: null }), card(4639, "beta")],
			}),
			/Why it matters" section is missing/,
		);
	});

	it("fails without How to use it", () => {
		fails(
			bundle({
				cards: [card(1710, "stable", { how: null }), card(4639, "beta")],
			}),
			/How to use it" section is missing/,
		);
	});

	it("fails on an unknown card section", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable", { how: "Do it.\n\n### Gotchas\n\nNone." }),
					card(4639, "beta"),
				],
			}),
			/unexpected section "### Gotchas"/,
		);
	});

	it("fails when the example is not a single code block", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable", {
						example: "Some prose.\n\n```yaml\na: 1\n```",
					}),
					card(4639, "beta"),
				],
			}),
			/Example must be a single code block/,
		);
		fails(
			bundle({
				cards: [
					card(1710, "stable", {
						example: "```yaml\na: 1\n```\n\n```yaml\nb: 2\n```",
					}),
					card(4639, "beta"),
				],
			}),
			/Example must be a single code block/,
		);
	});

	it("fails when the example YAML does not parse", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable", { example: "```yaml\nkind: [Pod\n```" }),
					card(4639, "beta"),
				],
			}),
			/Example YAML does not parse/,
		);
	});

	it("accepts multi-document YAML and shell examples", () => {
		ok(
			bundle({
				cards: [
					card(1710, "stable", { example: "```yaml\na: 1\n---\nb: 2\n```" }),
					card(4639, "beta", { example: "```shell\nkubectl get pods\n```" }),
				],
			}),
		);
	});

	it("fails when a question cites a KEP with no card", () => {
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "single"),
					question("q02", "kep-4639", "single"),
					question("q03", "kep-9999", "single"),
				],
			}),
			/kep-9999 is not a card in this bundle/,
		);
	});

	it("fails when single has no or several correct choices", () => {
		for (const choices of [
			"- [ ] a One\n- [ ] b Two",
			"- [x] a One\n- [x] b Two",
		])
			fails(
				bundle({
					questions: [
						question("q01", "kep-1710", "single", choices),
						question("q02", "kep-4639", "single"),
					],
				}),
				/a single question needs exactly one correct choice/,
			);
	});

	it("fails when true_false is not exactly one correct of True and False", () => {
		fails(
			bundle({
				questions: [
					question(
						"q01",
						"kep-1710",
						"true_false",
						"- [x] a True\n- [x] b False",
					),
					question("q02", "kep-4639", "single"),
				],
			}),
			/a true_false question needs exactly one correct choice/,
		);
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "true_false", "- [x] a Yes\n- [ ] b No"),
					question("q02", "kep-4639", "single"),
				],
			}),
			/"a True" and "b False"/,
		);
	});

	it("fails when multiple has fewer than two correct choices", () => {
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "single"),
					question("q02", "kep-4639", "multiple"),
				],
			}),
			/a multiple question needs at least two correct choices, has 1/,
		);
	});

	it("fails on an empty or missing explanation", () => {
		for (const explanation of ["", ">", "> <!-- TODO -->"])
			fails(
				bundle({
					questions: [
						question("q01", "kep-1710", "single", undefined, explanation),
						question("q02", "kep-4639", "single"),
					],
				}),
				/the explanation is empty/,
			);
	});

	it("fails when a stage with cards has no question", () => {
		const errors = fails(
			bundle({
				cards: [card(1710, "stable"), card(4639, "beta"), card(5000, "alpha")],
				questions: [
					question("q01", "kep-1710", "single"),
					question("q02", "kep-4639", "single"),
				],
			}),
			/no quiz question covers a alpha card/,
		);
		expect(
			errors.filter((e) => e.includes("no quiz question covers")),
		).toHaveLength(1);
	});

	it("does not count release-level questions towards a stage", () => {
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "single"),
					question("q02", "-", "single"),
				],
			}),
			/no quiz question covers a beta card/,
		);
	});

	it("fails on choices without their letter, or more than four", () => {
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "single", "- [ ] First\n- [x] Second"),
					question("q02", "kep-4639", "single"),
				],
			}),
			/choice 1 must start with its letter "a"/,
		);
		fails(
			bundle({
				questions: [
					question(
						"q01",
						"kep-1710",
						"single",
						"- [x] a 1\n- [ ] b 2\n- [ ] c 3\n- [ ] d 4\n- [ ] e 5",
					),
					question("q02", "kep-4639", "single"),
				],
			}),
			/at most 4 choices/,
		);
	});

	it("fails on Markdown in What and in choices", () => {
		fails(
			bundle({
				cards: [
					card(1710, "stable", { what: "It adds `spec.foo` to Pods." }),
					card(4639, "beta"),
				],
			}),
			/What is plain text/,
		);
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "single", "- [ ] a `one`\n- [x] b Two"),
					question("q02", "kep-4639", "multiple", MULTIPLE),
				],
			}),
			/choice a is plain text/,
		);
	});

	it("fails on duplicate question ids", () => {
		fails(
			bundle({
				questions: [
					question("q01", "kep-1710", "single"),
					question("q01", "kep-4639", "single"),
				],
			}),
			/duplicate question 1.37\/q01/,
		);
	});

	it("fails on bad frontmatter", () => {
		fails(
			bundle({ front: FRONTMATTER.replace('id: "1.37"', "id: 1.30") }),
			/id must be a string/,
		);
		fails(
			bundle({ front: FRONTMATTER.replace("2026-11-16", "2026-11-xx") }),
			/publishedAt must be a date/,
		);
		fails(
			bundle({
				front: FRONTMATTER.replace(
					/summary: .*/,
					`summary: ${"x".repeat(161)}`,
				),
			}),
			/summary is 161 characters/,
		);
		fails(
			bundle({ front: FRONTMATTER.replace("alpha: 0, ", "") }),
			/upstreamCounts needs whole numbers/,
		);
		fails(
			bundle({ front: FRONTMATTER.replace('id: "1.37"', 'id: "01.37"') }),
			/id must look like "1.37"/,
		);
		fails(
			bundle({
				front: FRONTMATTER.replace("2026-11-16", "2026-11-16T10:00"),
			}),
			/publishedAt must be a date/,
		);
		fails(bundle().replace(INTRO, ""), /the release intro is empty/);
	});

	it("reports every error, not just the first", () => {
		const errors = fails(
			bundle({
				cards: [
					card(1710, "stable", { why: null, what: "One. Two." }),
					card(4639, "beta", { how: null }),
				],
			}),
			/Why it matters/,
		);
		expect(errors.length).toBeGreaterThanOrEqual(3);
	});

	it("warns when derived counts differ from upstream", () => {
		const result = parse(
			bundle({ front: FRONTMATTER.replace("alpha: 0", "alpha: 2") }),
		);
		expect(result.errors).toEqual([]);
		expect(result.warnings).toContain(
			"b.md: alpha: 0 cards, but upstreamCounts says 2",
		);
	});

	it("warns when publishedAt is not in the future", () => {
		const result = parseBundle(bundle(), {
			file: "b.md",
			now: new Date("2027-01-01T00:00:00Z"),
		});
		expect(result.errors).toEqual([]);
		expect(
			result.warnings.some((w) => w.includes("public as soon as it loads")),
		).toBe(true);
	});
});

describe("sentenceCount", () => {
	it("counts sentences, ignoring abbreviations, versions and code", () => {
		expect(sentenceCount("Mount volumes faster.")).toBe(1);
		expect(sentenceCount("Works on v1.37 nodes, e.g. Linux ones.")).toBe(1);
		expect(sentenceCount("Set `a. B` on the Pod.")).toBe(1);
		expect(sentenceCount("Fast. Safe.")).toBe(2);
		expect(sentenceCount("Really? Yes!")).toBe(2);
	});
});

describe("report", () => {
	it("prints derived and upstream counts and reading time", () => {
		const parsed = ok(bundle());
		const text = report(parsed);
		expect(text).toContain('Kubernetes v1.37 "Garhwal" (1.37)');
		expect(text).toMatch(/stable\s+1\s+1/);
		expect(text).toMatch(/total\s+2\s+2/);
		expect(text).toContain("quiz questions: 3");
		expect(text).toContain(
			`estimated reading time: ${readingMinutes(parsed)} min`,
		);
	});
});

describe("toSql", () => {
	const SMALL = bundle({
		cards: [
			card(1710, "stable", {
				meta: "title: Speed up SELinux relabelling\ngate-default: off",
				why: "It's quick.",
				example: null,
			}),
		],
		questions: [
			question("q01", "kep-1710", "true_false", TRUE_FALSE, "> Yes."),
		],
		front: FRONTMATTER.replace(/upstreamCounts.*\n/, "").replace(
			/changelogUrl.*\n/,
			"",
		),
	});

	it("matches the snapshot", () => {
		expect(toSql(ok(SMALL), { now: NOW })).toMatchSnapshot();
	});

	it("uses seconds for timestamps and milliseconds for updated_at", () => {
		const sql = toSql(ok(SMALL), { now: NOW });
		expect(sql).toContain(String(Date.UTC(2026, 7, 26) / 1000));
		expect(sql).toContain(String(NOW.getTime()));
		expect(sql).toContain("It''s quick.");
		expect(sql.split("--> statement-breakpoint")).toHaveLength(5);
	});

	describe("against a migrated D1", () => {
		let db: Awaited<ReturnType<typeof migratedD1>>;
		beforeAll(async () => {
			db = await migratedD1(join(import.meta.dir, ".."));
		});
		afterAll(() => db?.dispose());

		const count = async (table: string) =>
			(
				await db.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{
					n: number;
				}>()
			)?.n;

		it("loads, reloads idempotently and drops removed children", async () => {
			const full = toSql(ok(bundle()), { now: NOW });
			await exec(db.DB, full);
			await exec(db.DB, full);
			expect(await count("releases")).toBe(1);
			expect(await count("release_features")).toBe(2);
			expect(await count("quiz_questions")).toBe(3);

			const later = new Date(NOW.getTime() + 1000);
			await exec(db.DB, toSql(ok(SMALL), { now: later }));
			expect(await count("releases")).toBe(1);
			expect(await count("release_features")).toBe(1);
			expect(await count("quiz_questions")).toBe(1);
			const row = await db.DB.prepare(
				"SELECT updated_at, upstream_counts, changelog_url FROM releases WHERE id = '1.37'",
			).first<Record<string, unknown>>();
			expect(row).toEqual({
				updated_at: later.getTime(),
				upstream_counts: null,
				changelog_url: null,
			});
		});
	});
});

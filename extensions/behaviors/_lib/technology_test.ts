import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
	applyChanges,
	buildStatement,
	evaluate,
	type Evidence,
	parseRow,
	planChanges,
	reviewDraft,
	seoFieldsToDraft,
	seoPrompt,
	uncovered,
	validateValue,
} from "./technology.ts";

const row = {
	id: "example",
	name: "Example",
	description: "An example.",
	body: '{"type":"doc","content":[]}',
	website: "http://example.dev/",
	documentation: "",
	source: "https://github.com/old/example",
	license: "Unknown",
	status: "stable",
	category: "Runtime",
	subcategory: "Container Runtime",
	related_technologies: '["kubernetes","gone"]',
	logos: '{"icon":true}',
	cncf: '{"status":"sandbox","accepted":"2020-01-01"}',
	community: '{"slack":"https://slack.example.dev/"}',
	updated_at: 1700000000000,
};

const evidence: Evidence = {
	landscapeAvailable: true,
	landscape: {
		matchedBy: "source",
		item: {
			name: "Example",
			category: "Runtime",
			subcategory: "Container Runtime",
			maturity: "incubating",
			accepted_at: "2020-01-01",
			incubating_at: "2022-02-02",
			twitter_url: "https://twitter.com/example",
			documentation_url: "https://example.dev/docs",
			summary: { tags: ["Runtime", "Kubernetes", " ", "Kubernetes"] },
		},
	},
	repository: {
		state: "ok",
		url: "https://github.com/new/example",
		archived: false,
		license: "Apache-2.0",
	},
	links: {
		"http://example.dev/": {
			state: "redirected",
			finalUrl: "https://example.dev/",
		},
		"https://slack.example.dev/": { state: "broken", status: 404 },
	},
	logos: { icon: false, horizontal: true, stacked: false },
	knownIdentifiers: ["example", "kubernetes"],
	websiteDescription: null,
};

Deno.test("evaluate proposes only what an authoritative source backs", () => {
	const technology = parseRow(row);
	const status = Object.fromEntries(
		evaluate(technology, evidence).map((finding) => [finding.field, finding]),
	);
	assertEquals(status.website.observed, "https://example.dev/");
	assertEquals(status.website.status, "proposed");
	assertEquals(status.documentation.status, "missing");
	assertEquals(status.source.status, "proposed");
	assertEquals(status.license.status, "proposed");
	assertEquals(status["cncf.status"].observed, "incubating");
	assertEquals(status["cncf.accepted"].status, "verified");
	assertEquals(status["cncf.tags"].observed, ["Runtime", "Kubernetes"]);
	assertEquals(status["matrix.status"].observed, "under-review");
	assertEquals(
		planChanges(technology, [status["matrix.status"]], [], {})[0].reason,
		"default",
	);
	assertEquals(status["community.twitter"].status, "proposed");
	assertEquals(status["community.slack"].status, "broken");
	assertEquals(status.related_technologies.observed, ["kubernetes"]);
	assertEquals(status["logos.icon"].observed, null);
	assertEquals(status["logos.horizontal"].observed, true);
});

Deno.test("a name-only landscape match is never applied unasked", () => {
	const findings = evaluate(parseRow(row), {
		...evidence,
		landscape: { ...evidence.landscape!, matchedBy: "name" },
	});
	assertEquals(
		findings.find((finding) => finding.field === "cncf.status")?.status,
		"mismatch",
	);
});

Deno.test("the plan applies proposals, accepted findings and requests", () => {
	const technology = parseRow(row);
	const used = new Set<string>();
	const changes = planChanges(
		technology,
		evaluate(technology, evidence),
		["example:documentation", "community.slack"],
		{ license: "MIT" },
		used,
	);
	assertEquals([...used].sort(), ["community.slack", "example:documentation"]);
	const columns = applyChanges(technology, changes);
	assertEquals(columns.license, "MIT");
	assertEquals(columns.documentation, "https://example.dev/docs");
	assertEquals(columns.community, { twitter: "https://twitter.com/example" });
	assertEquals(columns.logos, { horizontal: true });
	assertEquals(columns.related_technologies, undefined);

	const statement = buildStatement(technology, {
		license: "MIT",
		logos: null,
		cncf: { status: "incubating" },
	});
	assertEquals(
		statement.sql,
		"UPDATE technologies SET license = ?1, logos = NULL, cncf = ?2, " +
			"updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 " +
			"WHERE id = ?3 AND coalesce(updated_at, 0) = CAST(?4 AS INTEGER)",
	);
	assertEquals(statement.params, [
		"MIT",
		'{"status":"incubating"}',
		"example",
		"1700000000000",
	]);
});

Deno.test("descriptions are held to search-result standards", () => {
	const status = (extra: Record<string, unknown>) =>
		Object.fromEntries(
			evaluate(parseRow({ ...row, ...extra }), evidence)
				.map((finding) => [finding.field, finding]),
		);

	const bare = status({});
	assertEquals(bare["seo.title"].status, "missing");
	assertEquals(bare["seo.description"].status, "missing");
	assertEquals(bare.description.status, "invalid");

	const good = status({
		description: `Example is a container runtime. ${
			"It runs things. ".repeat(20)
		}`,
		seo: JSON.stringify({
			title: "Example Tutorials, Guides, and Best Practices",
			description:
				"Learn Example with practical tutorials, production patterns, and troubleshooting guides for platform engineers.",
		}),
	});
	assertEquals(good["seo.title"].status, "verified");
	assertEquals(good["seo.description"].status, "verified");
	assertEquals(good.description.status, "info");

	const weak = status({
		description: `A container runtime. ${"It runs things. ".repeat(20)}`,
		seo: JSON.stringify({
			title: "Tutorials",
			description: "Tutorials",
		}),
	});
	assertEquals(
		weak["seo.title"].note,
		"9 characters (30-60 recommended); does not name Example",
	);
	assertEquals(
		weak["seo.description"].note,
		"9 characters (70-160 recommended); does not name Example; repeats the title",
	);
	assertEquals(
		weak.description.note?.startsWith(
			"SEO: opening sentence does not name Example",
		),
		true,
	);
});

Deno.test("weak search-result text is drafted and the draft is checked", () => {
	const technology = parseRow(row);
	const findings = evaluate(technology, evidence);
	const fields = seoFieldsToDraft(findings);
	assertEquals(fields, ["seo.title", "seo.description"]);
	assertEquals(
		seoPrompt(technology, findings, evidence)?.startsWith(
			"Technology name: Example\nCategory: Runtime / Container Runtime",
		),
		true,
	);
	assertEquals(seoPrompt(technology, [], evidence), null);

	const review = reviewDraft(technology, fields, {
		title: "Example Tutorials, Guides, and Best Practices",
		description: "Too short for Example.",
	});
	assertEquals(review.values, {
		"seo.title": "Example Tutorials, Guides, and Best Practices",
	});
	assertEquals(review.rejected, [
		'seo.description: 22 characters (70-160 recommended) - "Too short for Example."',
	]);

	const changes = planChanges(
		technology,
		findings,
		[],
		{},
		new Set(),
		review.values,
	);
	assertEquals(
		changes.find((change) => change.field === "seo.title")?.reason,
		"drafted",
	);
	assertEquals(applyChanges(technology, changes).seo, {
		title: "Example Tutorials, Guides, and Best Practices",
	});
});

Deno.test("landscape projects without a technology are found", () => {
	const technologies = [
		parseRow({ ...row, aliases: '["Sample"]' }),
		parseRow({ id: "other", name: "Other", website: "https://other.dev" }),
	];
	const projects = [
		{
			name: "Renamed",
			repositories: [{ url: "https://github.com/old/example/" }],
		},
		{ name: "Elsewhere", homepage_url: "https://other.dev/" },
		{ name: "sample" },
		{ name: "Absent", homepage_url: "https://absent.dev" },
	];
	assertEquals(
		uncovered(technologies, projects).map((project) => project.name),
		["Absent"],
	);
});

Deno.test("values are validated against the column's rules", () => {
	assertEquals(validateValue("status", "stable", []), null);
	assertEquals(validateValue("community.twitter", null, []), null);
	assertEquals(typeof validateValue("status", "retired", []), "string");
	assertEquals(typeof validateValue("name", null, []), "string");
	assertEquals(typeof validateValue("website", "example.dev", []), "string");
	assertEquals(
		typeof validateValue("related_technologies", ["nope"], ["kubernetes"]),
		"string",
	);
	assertEquals(typeof validateValue("nonsense", "x", []), "string");
});

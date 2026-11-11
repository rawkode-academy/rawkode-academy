import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
	applyChanges,
	buildStatement,
	evaluate,
	type Evidence,
	parseRow,
	planChanges,
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

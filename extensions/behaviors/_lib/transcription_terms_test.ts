import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import {
	buildStatements,
	notStored,
	parseKinds,
	personTerms,
	summarise,
	synchronise,
	technologyTerms,
	toEntities,
	toTerms,
} from "./transcription_terms.ts";

const technologies = toEntities("technology", [
	{ id: "argo", name: "Argo", aliases: '["Argo CD","argo"," "]' },
	{ id: "bun", name: "Bun", aliases: null },
]);
const people = toEntities("person", [
	{ id: "bun", name: "Bun Li", forename: "Bun", surname: "Li" },
	{ id: "salaboy", name: "Salaboy", forename: "Mauricio", surname: "Salatino" },
]);
const entities = [...technologies, ...people];
const both = parseKinds("");

Deno.test("a technology gives its name and each alias, once", () => {
	assertEquals(
		technologyTerms({ name: " Argo ", aliases: '["Argo CD","ARGO",""]' }),
		["Argo", "Argo CD"],
	);
	assertEquals(technologyTerms({ name: "Bun", aliases: ["bunx"] }), [
		"Bun",
		"bunx",
	]);
	assertEquals(technologyTerms({ name: "Bun", aliases: "not json" }), ["Bun"]);
	assertEquals(technologyTerms({ name: "", aliases: null }), []);
});

Deno.test("a person gives the display name, the full name and the surname", () => {
	assertEquals(
		personTerms({
			name: "Nick Stinemates",
			forename: "Nick",
			surname: "Stinemates",
		}),
		["Nick Stinemates", "Stinemates"],
	);
	assertEquals(
		personTerms({ name: "Salaboy", forename: "Mauricio", surname: "Salatino" }),
		["Salaboy", "Mauricio Salatino", "Salatino"],
	);
	assertEquals(personTerms({ name: "", forename: "Bun", surname: "Li" }), [
		"Bun Li",
	]);
	assertEquals(personTerms({ name: "Thilo", forename: "Thilo", surname: "" }), [
		"Thilo",
	]);
});

Deno.test("kinds default to both and reject anything else", () => {
	assertEquals(both, ["technology", "person"]);
	assertEquals(parseKinds(" person "), ["person"]);
	assertThrows(() => parseKinds("person,video"), Error, "video");
});

Deno.test("only terms that are not stored in any case are missing", () => {
	const existing = toTerms([
		{ kind: "technology", foreignId: "argo", term: "ARGO" },
		{ kind: "technology", foreignId: "argo", term: "GitOps" },
		{ kind: "person", foreignId: "bun", term: "Bun Li" },
	]);
	const result = synchronise(entities, existing, both, []);
	assertEquals(result.missing, [
		{ kind: "technology", foreignId: "argo", term: "Argo CD" },
		{ kind: "technology", foreignId: "bun", term: "Bun" },
		{ kind: "person", foreignId: "salaboy", term: "Salaboy" },
		{ kind: "person", foreignId: "salaboy", term: "Mauricio Salatino" },
		{ kind: "person", foreignId: "salaboy", term: "Salatino" },
	]);
	assertEquals(result.examined, { technology: 2, person: 2 });
	assertEquals(result.orphaned, []);
});

Deno.test("a term of one kind does not satisfy the same id of another", () => {
	const existing = toTerms([
		{ kind: "technology", foreignId: "bun", term: "Bun Li" },
	]);
	const result = synchronise(entities, existing, ["person"], ["bun"]);
	assertEquals(result.missing, [
		{ kind: "person", foreignId: "bun", term: "Bun Li" },
	]);
	assertEquals(result.examined, { person: 1 });
});

Deno.test("orphans are reported for the kinds in scope and never planned", () => {
	const existing = toTerms([
		{ kind: "technology", foreignId: "gone", term: "Gone" },
		{ kind: "person", foreignId: "argo", term: "Argo" },
		{ kind: "video", foreignId: "abc", term: "Kueue" },
	]);
	const result = synchronise(entities, existing, both, ["bun"]);
	assertEquals(result.orphaned, [
		{ kind: "technology", foreignId: "gone", term: "Gone" },
		{ kind: "person", foreignId: "argo", term: "Argo" },
	]);
	assertEquals(result.missing.map((term) => term.foreignId), ["bun", "bun"]);
	assertEquals(
		synchronise(entities, existing, ["technology"], []).orphaned,
		[{ kind: "technology", foreignId: "gone", term: "Gone" }],
	);
});

Deno.test("an identifier matching nothing in scope is reported", () => {
	assertEquals(
		synchronise(entities, [], ["technology"], ["argo", "salaboy", "nope"])
			.unknown,
		["salaboy", "nope"],
	);
});

Deno.test("statements insert or ignore, thirty terms at a time", () => {
	assertEquals(buildStatements([]), []);
	const missing = Array.from({ length: 31 }, (_, index) => ({
		kind: "technology",
		foreignId: "bun",
		term: `term ${index}`,
	}));
	const statements = buildStatements(missing);
	assertEquals(statements.length, 2);
	assertEquals(statements[0].params.length, 90);
	assertEquals(
		statements[1],
		{
			sql:
				"INSERT OR IGNORE INTO transcription_terms (kind, foreignId, term) VALUES (?1, ?2, ?3)",
			params: ["technology", "bun", "term 30"],
		},
	);
	assertEquals(statements[0].sql.includes("(?88, ?89, ?90)"), true);
	assertEquals(/UPDATE|DELETE|REPLACE/i.test(statements[0].sql), false);
});

Deno.test("confirmation needs the exact planned term", () => {
	const planned = [
		{ kind: "technology", foreignId: "bun", term: "Bun" },
		{ kind: "person", foreignId: "bun", term: "Bun Li" },
	];
	const stored = toTerms([
		{ kind: "technology", foreignId: "bun", term: "bun" },
		{ kind: "person", foreignId: "bun", term: "Bun Li" },
	]);
	assertEquals(notStored(planned, stored), [planned[0]]);
	assertEquals(notStored(planned, [...stored, planned[0]]), []);
});

Deno.test("the summary lists inserts and orphans by entity", () => {
	assertEquals(
		summarise({
			missing: [
				{ kind: "technology", foreignId: "argo", term: "Argo" },
				{ kind: "technology", foreignId: "argo", term: "Argo CD" },
			],
			orphaned: [{ kind: "person", foreignId: "gone", term: "Gone" }],
			examined: {},
			unknown: [],
		}),
		"To insert (2):\n  technology argo: Argo, Argo CD\n" +
			"Orphaned, reported only (1):\n  person gone: Gone",
	);
	assertEquals(
		summarise({ missing: [], orphaned: [], examined: {}, unknown: [] }),
		"Every name is already a transcription term; nothing to write.",
	);
});

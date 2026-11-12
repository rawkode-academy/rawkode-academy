import { assertEquals, assertThrows } from "jsr:@std/assert@1.0.13";
import {
	applyChanges,
	buildStatement,
	columnMatches,
	evaluate,
	evaluateLinks,
	extractHandle,
	linksToCheck,
	parseLink,
	parseRow,
	type PersonEvidence,
	planChanges,
	validateValue,
} from "./person.ts";

const row = {
	id: "example",
	forename: "Ada",
	surname: "Lovelace",
	name: "Ada Lovelace",
	github: "old-ada",
	twitter: "ada",
	bluesky: "ada.example.dev",
	linkedin: "https://www.linkedin.com/in/ada-lovelace/",
	mastodon: "https://hachyderm.io/@ada",
	website: "http://ada.example.dev/",
	youtube: "https://www.youtube.com/@gone",
	updated_at: 1700000000000,
};

const evidence: PersonEvidence = {
	github: { state: "ok", handle: "ada", source: "GitHub API" },
	bluesky: { state: "missing", source: "Bluesky AppView" },
	links: {
		"https://hachyderm.io/@ada": { state: "ok", status: 200 },
		"http://ada.example.dev/": {
			state: "redirected",
			status: 200,
			finalUrl: "https://ada.example.dev/",
		},
		"https://www.youtube.com/@gone": { state: "broken", status: 404 },
	},
};

function statuses(findings: Array<{ field: string; status: string }>) {
	return Object.fromEntries(
		findings.map((finding) => [finding.field, finding.status]),
	);
}

Deno.test("parseRow turns empty columns into null", () => {
	const person = parseRow({ id: "thilo", forename: "Thilo", surname: "" });
	assertEquals(person.columns.surname, null);
	assertEquals(person.columns.github, null);
	assertEquals(person.updatedAt, null);
});

Deno.test("extractHandle finds the handle inside a profile URL", () => {
	assertEquals(
		extractHandle("github", "https://github.com/rawkode/"),
		"rawkode",
	);
	assertEquals(extractHandle("twitter", "@rawkode"), "rawkode");
	assertEquals(extractHandle("twitter", "https://x.com/rawkode"), "rawkode");
	assertEquals(
		extractHandle("bluesky", "https://bsky.app/profile/rawkode.dev"),
		"rawkode.dev",
	);
	assertEquals(extractHandle("github", "not a handle"), null);
});

Deno.test("evaluate proposes only what a site itself reports", () => {
	const findings = evaluate(parseRow(row), evidence);
	assertEquals(statuses(findings), {
		forename: "info",
		surname: "info",
		name: "verified",
		github: "proposed",
		twitter: "unverified",
		bluesky: "broken",
		linkedin: "invalid",
		mastodon: "verified",
		website: "proposed",
		youtube: "broken",
	});
	const observed = Object.fromEntries(
		findings.filter((finding) => finding.observed !== undefined)
			.map((finding) => [finding.field, finding.observed]),
	);
	assertEquals(observed, {
		github: "ada",
		bluesky: null,
		linkedin: "ada-lovelace",
		website: "https://ada.example.dev/",
		youtube: null,
	});
});

Deno.test("evaluate never guesses when a site did not answer", () => {
	const findings = evaluate(parseRow(row), {
		github: { state: "unavailable", detail: "GitHub API answered 403" },
		bluesky: null,
		links: {
			"https://www.youtube.com/@gone": {
				state: "redirected",
				finalUrl: "https://consent.youtube.com/m?continue=x",
			},
			"https://hachyderm.io/@ada": { state: "blocked", status: 403 },
		},
	});
	const outcome = statuses(findings);
	assertEquals(outcome.github, "unverified");
	assertEquals(outcome.bluesky, "unverified");
	assertEquals(outcome.youtube, "unverified");
	assertEquals(outcome.mastodon, "unverified");
	assertEquals(outcome.website, "unverified");
	assertEquals(
		findings.filter((finding) =>
			finding.observed !== undefined &&
			finding.field !== "linkedin"
		),
		[],
	);
});

Deno.test("evaluate accepts a handle that differs only by case", () => {
	const findings = evaluate(parseRow({ ...row, github: "ADA" }), evidence);
	const github = findings.find((finding) => finding.field === "github");
	assertEquals(github?.status, "verified");
	assertEquals(github?.note, "GitHub spells it ada");
});

Deno.test("evaluate checks the shape of the names", () => {
	const spaced = evaluate(
		parseRow({ id: "a", forename: " Ada", surname: "Love  lace", name: "" }),
		{ github: null, bluesky: null, links: {} },
	);
	assertEquals(statuses(spaced), {
		forename: "invalid",
		surname: "invalid",
		name: "missing",
	});
	assertEquals(
		spaced.map((finding) => finding.observed),
		["Ada", "Love lace", "Ada Love lace"],
	);

	const single = evaluate(
		parseRow({ id: "thilo", forename: "Thilo", surname: "", name: "Thilo" }),
		{ github: null, bluesky: null, links: {} },
	);
	assertEquals(statuses(single), {
		forename: "info",
		surname: "info",
		name: "verified",
	});

	const display = evaluate(
		parseRow({ id: "a", forename: "Ada", surname: "King", name: "Ada L" }),
		{ github: null, bluesky: null, links: {} },
	);
	const name = display.find((finding) => finding.field === "name");
	assertEquals(name?.status, "mismatch");
	assertEquals(name?.observed, "Ada King");
});

Deno.test("planChanges applies proposals, accepted findings and requests", () => {
	const person = parseRow(row);
	const findings = evaluate(person, evidence);
	const used = new Set<string>();
	const changes = planChanges(
		person,
		findings,
		["example:linkedin", "youtube", "twitter"],
		{ mastodon: null, name: "Ada Lovelace" },
		used,
	);
	assertEquals(
		changes.map((change) => [change.field, change.to, change.reason]),
		[
			["github", "ada", "verified source"],
			["linkedin", "ada-lovelace", "accepted"],
			["website", "https://ada.example.dev/", "verified source"],
			["youtube", null, "accepted"],
			["mastodon", null, "requested"],
		],
	);
	// twitter has no observed value, so accepting it matches nothing.
	assertEquals([...used].sort(), ["example:linkedin", "youtube"]);
});

Deno.test("validateValue refuses values the columns cannot hold", () => {
	assertEquals(validateValue("github", "rawkode"), null);
	assertEquals(validateValue("github", null), null);
	assertEquals(validateValue("surname", null), null);
	assertEquals(validateValue("bluesky", "rawkode.dev"), null);
	assertEquals(validateValue("website", "https://rawkode.dev/"), null);
	assertEquals(
		validateValue("forename", null),
		'"forename" is required and cannot be cleared',
	);
	assertEquals(
		validateValue("github", "https://github.com/rawkode"),
		'"github" must be a bare GitHub handle, not a URL or an @-prefixed value',
	);
	assertEquals(
		validateValue("youtube", "@RawkodeAcademy"),
		'"youtube" must be an http(s) URL',
	);
	assertEquals(
		validateValue("name", "Ada  Lovelace"),
		'"name" must not have leading, trailing or repeated spaces',
	);
	assertEquals(validateValue("biography", "x"), 'unknown field "biography"');
});

Deno.test("buildStatement updates only changed columns, guarded on updated_at", () => {
	const person = parseRow(row);
	const columns = applyChanges([
		{ field: "github", from: "old-ada", to: "ada", reason: "verified source" },
		{ field: "youtube", from: row.youtube, to: null, reason: "accepted" },
		{ field: "surname", from: "Lovelace", to: null, reason: "requested" },
	]);
	assertEquals(buildStatement(person, columns), {
		sql: "UPDATE people SET github = ?1, youtube = NULL, surname = '', " +
			"updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 " +
			"WHERE id = ?2 AND coalesce(updated_at, 0) = CAST(?3 AS INTEGER)",
		params: ["ada", "example", "1700000000000"],
	});
	assertEquals(
		buildStatement(parseRow({ id: "new" }), { github: "ada" }).params,
		["ada", "new", "0"],
	);
	assertThrows(() => buildStatement(person, { "github = 1; --": "x" }));
});

Deno.test("columnMatches compares a reread row with the plan", () => {
	const stored = parseRow({
		...row,
		github: "ada",
		youtube: null,
		surname: "",
	});
	assertEquals(columnMatches(stored, "github", "ada"), true);
	assertEquals(columnMatches(stored, "youtube", null), true);
	assertEquals(columnMatches(stored, "surname", null), true);
	assertEquals(
		columnMatches(stored, "website", "https://ada.example.dev/"),
		false,
	);
});

Deno.test("linksToCheck lists the URL columns only", () => {
	assertEquals(linksToCheck(parseRow(row)), [
		"https://hachyderm.io/@ada",
		"http://ada.example.dev/",
		"https://www.youtube.com/@gone",
	]);
});

Deno.test("evaluateLinks reports and never proposes", () => {
	const links = [
		{
			person_id: "example",
			url: "https://ada.example.dev/talks",
			name: "Talks",
		},
		{
			person_id: "example",
			url: "https://ada.example.dev/talks/",
			name: "Again",
		},
		{ person_id: "example", url: "http://ada.example.dev/book", name: "Book" },
		{ person_id: "example", url: "https://gone.example.dev/", name: "Gone" },
		{ person_id: "nobody", url: "https://ada.example.dev/", name: "" },
		{ person_id: "example", url: "ada.example.dev", name: "Bare" },
		{ person_id: "example", url: "https://slow.example.dev/", name: "Slow" },
	].map(parseLink);
	const findings = evaluateLinks(links, {
		"https://ada.example.dev/talks": { state: "ok", status: 200 },
		"http://ada.example.dev/book": {
			state: "redirected",
			finalUrl: "https://ada.example.dev/book",
		},
		"https://gone.example.dev/": { state: "broken", detail: "dns error" },
		"https://slow.example.dev/": { state: "error", detail: "timed out" },
	}, ["example"]);
	assertEquals(
		findings.map((finding) => [
			finding.status,
			finding.observed ?? finding.note,
		]),
		[
			["verified", "HTTP 200"],
			["invalid", "duplicate of another link"],
			["redirected", "https://ada.example.dev/book"],
			["broken", "dns error"],
			["invalid", "no person with this id; no name"],
			["invalid", "not an http(s) URL"],
			["unverified", "timed out"],
		],
	);
});

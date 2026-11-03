import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const logos = readFileSync(
	new URL("../components/organizations/PartnerLogos.astro", import.meta.url),
	"utf8",
);
test("Datum Cloud is the only current partner", () => {
	const currentList = logos.match(
		/const currentCompanies: Company\[\] = \[(.*?)\];/s,
	)?.[1];
	assert(currentList);
	assert.deepEqual(
		Array.from(currentList.matchAll(/name: "([^"]+)"/g), (match) => match[1]),
		["Datum Cloud"],
	);
});

test("the historical list contains the ten approved past partners", () => {
	const pastList = logos.match(
		/const pastCompanies: Company\[\] = \[(.*?)\];/s,
	)?.[1];
	assert(pastList);
	assert.deepEqual(
		Array.from(pastList.matchAll(/name: "([^"]+)"/g), (match) => match[1]),
		[
			"Spectro Cloud",
			"Teleport",
			"ControlPlane",
			"Fermyon",
			"Guidepad",
			"Heroku",
			"Microsoft Azure",
			"ngrok",
			"WunderGraph",
			"Zitadel",
		],
	);
	assert.doesNotMatch(logos, /Current partner|Past partners/);
	assert.doesNotMatch(logos, /Teams we've worked with/);
	assert.doesNotMatch(logos, /Armo|Komodor/);
});

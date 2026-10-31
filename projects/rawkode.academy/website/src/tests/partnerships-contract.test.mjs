import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";
import { test } from "node:test";

const read = (path) =>
	readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("pages/organizations/partnerships/index.astro");
const copy = read("lib/partnerships.ts");
const form = read("components/organizations/PartnershipApplicationForm.vue");
const action = read("actions/partnership.ts");

test("partnership work areas explain the service without becoming standalone packages", () => {
	assert.match(page, /Awareness, Adoption, and Support/);
	assert.match(page, /adoptionStages\.map/);
	assert.doesNotMatch(page, /stage\.offer|stage\.cta|stage\.route/);
	assert.doesNotMatch(
		copy,
		/export const (fitProofReview|handsOnContentOffer|supportOffer|supporterOffer|partnershipReviewCredit)/,
	);
	assert.doesNotMatch(
		page,
		/partnershipReviewCredit|counts towards|credit towards/i,
	);
	assert.match(page, /ongoingPartnershipOffer/);
	assert.match(page, /bespokeProjectOffer/);
	assert.match(copy, /price: "\$12,000 a quarter"/);
	assert.match(copy, /\$40,000 for a 12-month contract/);
});

test("page preserves an enquiry route and safe email delivery without CRM dependency", () => {
	assert.match(page, /id="measurement"/);
	assert.match(page, /ongoingQuarterExample/);
	assert.match(page, /independenceRules/);
	assert.match(page, /isVerbatimExcerpt/);
	assert.match(page, /serverFieldErrors=/);
	assert.match(page, /submittedValues=/);
	assert.match(form, /action="\?_action=partnership\.applyForm"/);
	assert.match(form, /capturePartnershipEvent\("enquiry_form_submitted"\)/);
	assert.match(action, /env\.PARTNERSHIP_EMAIL\.send/);
	assert.match(action, /to: PARTNERSHIP_EMAIL/);
	assert.doesNotMatch(action, /api\.attio\.com/);
});

// Block the rejected offer name across website sources, including metadata,
// mailto subjects and public files, rather than only checking the visible card.
const disallowedOfferName = new RegExp(
	["field", "report"].join("(?:[\\s_-]|%20)*"),
	"i",
);
const websiteTextExtensions = new Set([
	".astro",
	".vue",
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".json",
	".jsonld",
	".html",
	".md",
	".mdx",
	".txt",
	".xml",
	".svg",
	".csv",
	".yaml",
	".yml",
	".css",
	".toml",
]);
function* websiteSources(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (
			["tests", "__tests__", "node_modules", "dist", ".astro"].includes(
				entry.name,
			)
		)
			continue;
		const url = new URL(
			entry.name + (entry.isDirectory() ? "/" : ""),
			directory,
		);
		if (entry.isDirectory()) {
			yield* websiteSources(url);
		} else if (
			websiteTextExtensions.has(extname(entry.name)) &&
			!/[.](test|spec)[.]/.test(entry.name)
		) {
			yield url;
		}
	}
}

test("website production sources exclude the rejected offer name", () => {
	for (const directory of [
		new URL("../", import.meta.url),
		new URL("../../public/", import.meta.url),
	]) {
		for (const source of websiteSources(directory)) {
			assert.doesNotMatch(
				readFileSync(source, "utf8"),
				disallowedOfferName,
				source.pathname,
			);
		}
	}
});

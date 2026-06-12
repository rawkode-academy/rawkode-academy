/**
 * Single source of truth for the partnership offering.
 *
 * Every page that names a tier, quotes a price, or links a contact
 * mailto must consume this module so the copy cannot drift between
 * /organizations, /organizations/partnerships, and
 * /organizations/lets-chat.
 */

export const PARTNERSHIP_EMAIL = "david@rawkode.academy";

/** Build an RFC 6068 mailto href with CRLF line breaks in the body. */
const buildMailto = (subject: string, body: string): string =>
	`mailto:${PARTNERSHIP_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;

export interface PartnershipTier {
	id: string;
	name: string;
	/** Short mono label shown above the tier name (Entry / Default / Cohort). */
	label: string;
	/** Full price string, e.g. "£1,000 / month". */
	price: string;
	/** Compact price for stat rows, e.g. "£1k/mo". */
	priceShort: string;
	bestFor: string;
	outcome: string;
	included: string[];
	featured: boolean;
	/** Prefilled mailto for this tier. */
	mailto: string;
}

const tierBriefBody = (path: string): string =>
	[
		"Company and product:",
		`Preferred path: ${path}`,
		"Target developers or platform teams:",
		"Current adoption challenge:",
		"Links worth a look:",
	].join("\n");

export const partnershipTiers: PartnershipTier[] = [
	{
		id: "signal",
		name: "Signal",
		label: "Entry",
		price: "£1,000 / month",
		priceShort: "£1k/mo",
		bestFor:
			"Teams that want a recurring outside read on what developers understand, question, trust, or ignore.",
		outcome:
			"A clearer picture, every month, of where adoption is getting stuck and what is worth improving next.",
		included: [
			"A written monthly brief covering your docs, demos, positioning, and what developers are saying in public",
			"A running log of adoption blockers, tracked month over month",
			"One clear recommendation: what to keep, change, prove, pause, or escalate",
			"An optional public field note when the learning belongs in the community",
		],
		featured: false,
		mailto: buildMailto("Signal partnership", tierBriefBody("Signal")),
	},
	{
		id: "adoption",
		name: "Adoption",
		label: "Default",
		price: "£2,000 / month",
		priceShort: "£2k/mo",
		bestFor:
			"Teams ready to turn that recurring read into one focused adoption experiment each month.",
		outcome:
			"One adoption blocker per month moved from vague concern to a tested answer your team can act on.",
		included: [
			"Everything in Signal",
			"A monthly working session with your team on one adoption blocker",
			"A written experiment plan: the audience, the blocker, the hypothesis, and what success looks like",
			"A shared artifact your team can reuse in docs, demos, onboarding, or sales conversations",
			"An adoption map updated each month: what changed, what is still unclear, what to test next",
		],
		featured: true,
		mailto: buildMailto("Adoption partnership", tierBriefBody("Adoption")),
	},
	{
		id: "council",
		name: "Council",
		label: "Cohort",
		price: "£3,000 / month",
		priceShort: "£3k/mo",
		bestFor:
			"Teams that want peer comparison, expert perspective, and a shared room for serious developer adoption problems.",
		outcome:
			"Patterns from other member teams and outside experts, applied to your own adoption decisions.",
		included: [
			"Everything in Adoption",
			"A monthly cohort session with the other Council member teams",
			"Case reviews of live docs, demos, onboarding, and launches: yours and theirs",
			"A monthly industry expert presentation with working Q&A",
			"Written pattern notes: risks, experiments, and expert takeaways you can bring to your roadmap",
		],
		featured: false,
		mailto: buildMailto("Council partnership", tierBriefBody("Council")),
	},
];

/** "Signal, Adoption, or Council" for prose. */
export const partnershipTierNames = partnershipTiers.map((tier) => tier.name);

/** Boundaries: what the partnership intentionally does not include. */
export const partnershipBoundaries = [
	"Outsourced DevRel execution, or someone to run the function for you.",
	"Paid coverage, guaranteed mentions, media inventory, or lead generation.",
	"Campaign planning or custom content production on demand.",
	"Generic workshops disconnected from adoption strategy.",
	"Audience rental or open-ended access.",
];

/** General partnership-fit brief: subject, plain-text template, mailto. */
export const partnershipFitSubject = "Partnership fit";
export const partnershipFitTemplate = [
	"Company and product:",
	"Target developers or platform teams:",
	"Current adoption challenge:",
	"Links worth a look:",
].join("\n");
export const partnershipFitMailto = buildMailto(
	partnershipFitSubject,
	partnershipFitTemplate,
);

/** Decision brief used by /organizations and /organizations/lets-chat. */
export const decisionBriefSubject = "Decision brief request";
export const decisionBriefTemplate = [
	"Company/category:",
	"Preferred partnership path:",
	"Target technical evaluator:",
	"Team stakeholders:",
	"Deadline or launch window:",
	"Docs, demos, architecture notes, or enablement material:",
	"Infrastructure artifacts available:",
	"Adoption risk or decision to review:",
	"Links, if useful:",
].join("\n");
export const decisionBriefMailto = buildMailto(
	decisionBriefSubject,
	decisionBriefTemplate,
);

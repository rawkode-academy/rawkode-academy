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

const tierBriefBody = (path: string, extra?: string): string =>
	[
		"Company/category:",
		`Preferred partnership path: ${path}`,
		"Target developers or platform teams:",
		"Team stakeholders:",
		"Current adoption challenge:",
		...(extra ? [extra] : ["Current GTM, DevRel, or product rhythm:"]),
		"Useful links:",
	].join("\n");

export const partnershipTiers: PartnershipTier[] = [
	{
		id: "signal",
		name: "Signal",
		label: "Entry",
		price: "£1,000 / month",
		priceShort: "£1k/mo",
		bestFor:
			"Teams that need a recurring outside read on what developers understand, question, trust, or ignore.",
		outcome:
			"Each month gives your team a clearer read on adoption friction, proof gaps, and the next story or surface worth improving.",
		included: [
			"Monthly signal brief drawn from public technical work, product surfaces, category movement, and field notes",
			"Adoption friction tracked over time across positioning, docs, demos, onboarding, and narrative",
			"One clear recommendation for what to keep, change, prove, pause, or escalate",
			"Optional public field note when the learning belongs in the community",
		],
		featured: false,
		mailto: buildMailto("Signal path", tierBriefBody("Signal")),
	},
	{
		id: "adoption",
		name: "Adoption",
		label: "Default",
		price: "£2,000 / month",
		priceShort: "£2k/mo",
		bestFor:
			"Teams ready to turn recurring signal into a focused monthly adoption experiment.",
		outcome:
			"Each month moves one adoption blocker from vague concern to clearer experiment, evidence, and next step.",
		included: [
			"Everything in Signal",
			"Monthly working session around one adoption blocker",
			"Experiment shape: audience, friction, hypothesis, proof, and success signal",
			"Shared learning artifact your team can use in docs, demos, onboarding, narrative, or sales handoff",
			"Adoption map updated with what changed, what remains unclear, and what to test next",
		],
		featured: true,
		mailto: buildMailto("Adoption path", tierBriefBody("Adoption")),
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
			"Each month gives your team practitioner patterns from other members, expert perspective, and reusable language for the decisions ahead.",
		included: [
			"Everything in Adoption",
			"Shared monthly cohort room where Council members compare adoption problems",
			"Member case reviews around live docs, demos, narratives, onboarding, or launch motions",
			"Monthly industry expert presentation with working Q&A",
			"Council pattern notes with risks, experiments, expert takeaways, and useful decision language",
		],
		featured: false,
		mailto: buildMailto(
			"Council path",
			tierBriefBody("Council", "Cohort or expert themes that would help:"),
		),
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
	"Company/category:",
	"Product or platform:",
	"Target developers or platform teams:",
	"Team stakeholders:",
	"Current adoption challenge:",
	"Current GTM, DevRel, or product rhythm:",
	"What your team wants to learn or improve next:",
	"Useful links:",
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

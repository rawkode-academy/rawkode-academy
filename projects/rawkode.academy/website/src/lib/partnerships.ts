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
	/** Short mono label shown above the tier name (Slack / Slack + video / Cohort). */
	label: string;
	/** Full price string, e.g. "£1,000 / month". */
	price: string;
	/** Compact price for stat rows, e.g. "£1k/mo". */
	priceShort: string;
	bestFor: string;
	outcome: string;
	included: string[];
	featured: boolean;
	/** Scarcity or availability note, e.g. seat limits and cohort dates. */
	note?: string;
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
		label: "Slack",
		price: "£1,000 / month",
		priceShort: "£1k/mo",
		bestFor:
			"Teams that want an advisor in their Slack without adding another meeting to the calendar.",
		outcome:
			"Your plans and objectives, checked monthly against how developers actually evaluate tools.",
		included: [
			"Slack Connect with Rawkode Academy: advice on positioning, docs, demos, launches, and objections as they come up",
			"A monthly review of your high-level plans and objectives",
		],
		featured: false,
		mailto: buildMailto("Signal partnership", tierBriefBody("Signal")),
	},
	{
		id: "adoption",
		name: "Adoption",
		label: "Slack + video",
		price: "£2,000 / month",
		priceShort: "£2k/mo",
		bestFor:
			"Teams that want the advisor on video with the people doing the work, not just in threads.",
		outcome:
			"Adoption blockers worked through together, with evidence instead of opinion.",
		included: [
			"Everything in Signal",
			"A monthly video working session with your team on whatever matters most right now",
			"Experiment plans when a blocker needs evidence: the audience, the hypothesis, and what success looks like",
		],
		featured: true,
		mailto: buildMailto("Adoption partnership", tierBriefBody("Adoption")),
	},
	{
		id: "community",
		name: "Community",
		label: "Cohort",
		price: "£3,000 / month",
		priceShort: "£3k/mo",
		bestFor:
			"Teams that want peer comparison and expert perspective on serious developer adoption problems, in a room that stays small.",
		outcome:
			"Patterns from the other member teams and invited experts, applied to your own adoption decisions.",
		included: [
			"Everything in Adoption",
			"A monthly cohort session with the other member teams, capped at ten companies",
			"Case reviews of live docs, demos, onboarding, and launches: yours and theirs",
			"A monthly expert session drawn from the Rawkode network: maintainers, platform leads, and CNCF voices, with the calendar published a quarter ahead",
		],
		featured: false,
		note: "Limited to 10 teams. First cohort kicks off August 2026.",
		mailto: buildMailto("Community partnership", tierBriefBody("Community")),
	},
];

/** "Signal, Adoption, or Community" for prose. */
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

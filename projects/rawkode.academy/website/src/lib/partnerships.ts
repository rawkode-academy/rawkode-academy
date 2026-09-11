/**
 * Single source of truth for the organization partnership offering.
 *
 * Public SKUs only:
 * - Fit & Proof Sprint — £2,500 · about two weeks
 * - Adoption Advisory — £4,000 / month
 *
 * Killed: Signal, Community, three-tier comparison, August 2026 cohort lines.
 * Every org funnel page must consume this module so copy cannot drift.
 */

export const PARTNERSHIP_EMAIL = "david@rawkode.academy";

/** Build an RFC 6068 mailto href with CRLF line breaks in the body. */
const buildMailto = (subject: string, body: string): string =>
	`mailto:${PARTNERSHIP_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;

export interface PartnershipOffer {
	id: string;
	name: string;
	/** Mono kicker above the offer name. */
	label: string;
	/** Full price string shown on offer surfaces. */
	price: string;
	/** Compact price for meta strips. */
	priceShort: string;
	/** Duration / cadence line. */
	cadence: string;
	summary: string;
	included: string[];
	excluded: string[];
	notes: string[];
	mailto: string;
}

const sprintBriefBody = [
	"Company/product:",
	"Technical buyer:",
	"Adoption problem:",
	"Links:",
].join("\n");

/** Entry product: paid Fit & Proof Sprint before ongoing advisory. */
export const fitProofSprint: PartnershipOffer = {
	id: "fit-proof-sprint",
	name: "Fit & Proof Sprint",
	label: "How you start",
	price: "£2,500",
	priceShort: "£2.5k",
	cadence: "About two weeks",
	summary:
		"A bounded sprint to prove whether Rawkode is the right advisor for your adoption problem — and what to fix, prove, or stop next.",
	included: [
		"A focused review of the adoption problem in front of your technical buyers",
		"Slack access with a practitioner advisor for the sprint window",
		"Working sessions on the docs, demos, claims, or proof gaps that matter most",
		"A written readout: fit, priorities, and the decision to continue or stop",
		"Full Sprint fee credited toward Adoption Advisory if you start within 30 days",
	],
	excluded: [
		"Coverage, mentions, or editorial placement",
		"Lead generation or audience rental",
		"Outsourced DevRel, campaign planning, or custom content on demand",
		"Open-ended retainer access beyond the sprint window",
	],
	notes: [
		"No self-serve checkout. Apply below; David replies either way.",
		"If you continue into Adoption Advisory within 30 days, the Sprint fee is credited in full.",
	],
	mailto: buildMailto("Fit & Proof Sprint application", sprintBriefBody),
};

/** Ongoing offer: single Adoption Advisory retainer. */
export const adoptionAdvisory: PartnershipOffer = {
	id: "adoption-advisory",
	name: "Adoption Advisory",
	label: "Ongoing partnership",
	price: "£4,000 / month",
	priceShort: "£4k/mo",
	cadence: "90 days, then month-to-month",
	summary:
		"A practitioner advisor on your adoption problems. You own execution. Coverage is not for sale.",
	included: [
		"A practitioner advisor in your Slack via Slack Connect — questions as they come up",
		"Monthly review of plans and objectives against how developers actually evaluate tools",
		"Tactical reviews of the work itself: docs, demos, onboarding, launches, and proof gaps",
		"Experiment framing when a blocker needs evidence: audience, hypothesis, success signal",
		"One company per problem space at a time — exclusivity while we work together",
	],
	excluded: [
		"Paid coverage, guaranteed mentions, media inventory, or lead generation",
		"Outsourced DevRel execution or someone to run the function for you",
		"Campaign planning or custom content production on demand",
		"Audience rental or open-ended access without a clear adoption problem",
	],
	notes: [
		"Founding rate for the first teams; it will rise.",
		"Start with 90 days, then continue month-to-month.",
		"Pay twelve months, get two free.",
		"Seats are limited. If we are full for your problem space, you join the waitlist — no countdown theater.",
	],
	mailto: buildMailto(
		"Adoption Advisory application",
		[
			"Company/product:",
			"Technical buyer:",
			"Adoption problem:",
			"Links:",
		].join("\n"),
	),
};

/** Hub / partnerships role columns. */
export const partnershipRoles = [
	{
		value: "You own",
		label: "Execution, content, and community",
	},
	{
		value: "We bring",
		label: "An advisor who lives where developers evaluate tools",
	},
	{
		value: "You decide",
		label: "What to prove, change, or stop next",
	},
] as const;

/** Where adoption gets stuck — partnerships page. */
export const adoptionStuckAreas = [
	{
		title: "The story does not match the technical reality.",
		body: "The product is strong, but the public narrative skips the tradeoffs, proof, or context developers need before they trust it.",
	},
	{
		title: "The docs explain features, not confidence.",
		body: "Developers can understand what the product does and still not know whether it fits their workflow, team, risk, or next step.",
	},
	{
		title: "DevRel activity is busy but hard to connect.",
		body: "Content, community, education, and feedback all exist, but they do not clearly ladder into adoption.",
	},
	{
		title: "Sales conversations expose unresolved proof gaps.",
		body: "Technical buyers ask about operations, migration, security, cost, or fit, and the team has to assemble the answer late.",
	},
] as const;

/** Boundaries shared across org surfaces. */
export const partnershipBoundaries = [
	"Coverage is not for sale — no paid mentions, guaranteed placement, or editorial inventory.",
	"Not lead generation, audience rental, or a booth substitute.",
	"Not outsourced DevRel, campaign planning, or custom content on demand.",
	"Not a fractional hire who owns execution for you — your team keeps the work.",
	"Not generic workshops disconnected from a real adoption problem.",
] as const;

/** Application form product label (Sprint is the apply path). */
export const SPRINT_APPLICATION_PATH = "Fit & Proof Sprint" as const;

/** Sprint apply mailto used when the JS form is unavailable. */
export const sprintApplySubject = "Fit & Proof Sprint application";
export const sprintApplyTemplate = sprintBriefBody;
export const sprintApplyMailto = fitProofSprint.mailto;

/** @deprecated Prefer sprintApply* — kept as aliases for older imports. */
export const partnershipFitSubject = sprintApplySubject;
export const partnershipFitTemplate = sprintApplyTemplate;
export const partnershipFitMailto = sprintApplyMailto;
export const decisionBriefSubject = sprintApplySubject;
export const decisionBriefTemplate = sprintApplyTemplate;
export const decisionBriefMailto = sprintApplyMailto;

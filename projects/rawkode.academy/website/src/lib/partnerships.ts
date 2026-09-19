/**
 * Single source of truth for the Rawkode Academy partner programme.
 *
 * Every page that names the offer, quotes a price, or links a contact
 * mailto consumes this module so the public funnel cannot drift.
 */

export const PARTNERSHIP_EMAIL = "david@rawkode.academy";

/** Build an RFC 6068 mailto href with CRLF line breaks in the body. */
const buildMailto = (subject: string, body: string): string =>
	`mailto:${PARTNERSHIP_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, "\r\n"))}`;

export interface PartnershipOffer {
	id: string;
	name: string;
	label: string;
	price: string;
	priceShort: string;
	cadence: string;
	summary: string;
	included: string[];
	excluded: string[];
	notes: string[];
	mailto: string;
}

const applicationBody = [
	"Name:",
	"Company and product:",
	"Target developers or platform teams:",
	"Technical buyer:",
	"Current adoption challenge:",
	"Working demo, docs, or repository:",
	"Budget and preferred quarter:",
	"Links worth a look:",
].join("\n");

/**
 * The primary programme. Slack is a delivery channel, not an on-call
 * support promise. Demos and proof assets are deliberately bounded so the
 * partnership remains valuable without becoming an open-ended consultancy.
 */
export const partnershipOffer: PartnershipOffer = {
	id: "adoption-advisory",
	name: "Adoption Advisory",
	label: "Rawkode Partner Programme",
	price: "£4,000 / month",
	priceShort: "£4k/mo",
	cadence: "90 days, then month-to-month",
	summary:
		"A working partnership for infrastructure companies that need sharper technical proof, useful demos, and a practitioner's read on what developers will trust.",
	included: [
		"Slack Connect for questions, reviews, and decisions as they come up",
		"One scheduled working session each month",
		"One technical demo or proof asset each quarter, built with your team",
		"A companion page, reusable clips, and a shared partner asset repository",
		"A quarterly delivery and performance report with the next renewal decision",
	],
	excluded: [
		"On-call support, incident response, or implementation ownership",
		"Guaranteed leads, sign-ups, positive reviews, or independent editorial coverage",
		"Open-ended custom content, campaign planning, or unlimited revisions",
		"Audience rental or blanket category exclusivity",
	],
	notes: [
		"The partner supplies a working environment, technical SME, source material, and timely approvals.",
		"One factual-correction round is included for each published asset.",
		"Additional demos, series, or strategy work are separately scoped add-ons.",
	],
	mailto: buildMailto("Adoption Advisory application", applicationBody),
};

/** Optional paid qualification route. It is not required for every partner. */
export const fitProofReview: PartnershipOffer = {
	id: "fit-proof-review",
	name: "Fit & Proof Review",
	label: "Optional qualification",
	price: "£2,500",
	priceShort: "£2.5k",
	cadence: "One bounded review",
	summary:
		"A focused review of one technical buyer workflow, with a scorecard and a clear recommendation on whether Adoption Advisory is useful.",
	included: [
		"One named workflow and its current proof gap",
		"Async review of the supplied demo, docs, claims, and adoption context",
		"A written scorecard and one 60-minute readout",
		"Full fee credited toward Adoption Advisory when you start within 30 days",
	],
	excluded: [
		"Open-ended Slack access or implementation work",
		"Coverage, mentions, lead generation, or audience rental",
	],
	notes: [
		"The review is kept deliberately small. A working session or build beyond the named workflow is a separate engagement.",
	],
	mailto: buildMailto("Fit & Proof Review application", applicationBody),
};

/** Compatibility shape for components that render the primary offer. */
export const partnershipTiers = [partnershipOffer] as const;
export const partnershipTierNames = partnershipTiers.map((offer) => offer.name);

/** Options for the application form's preferred route field. */
export const applicationPaths = [
	"Adoption Advisory",
	"Fit & Proof Review",
	"Not sure yet",
] as const;
export type ApplicationPath = (typeof applicationPaths)[number];

/** Boundaries shared across the organisation and partner surfaces. */
export const partnershipBoundaries = [
	"Your team owns execution. Rawkode brings technical judgement, demos, and proof work.",
	"Sponsorship funds the work, not the verdict: no guaranteed praise, leads, or independent coverage.",
	"No on-call support, incident response, outsourced DevRel, or implementation ownership.",
	"No open-ended custom content, campaign planning, or unlimited revisions.",
	"Exclusivity is never blanket or automatic. Narrow exclusions are separately scoped and priced.",
] as const;

/** General partnership application mailto used as a fallback. */
export const partnershipFitSubject = "Rawkode Academy partner application";
export const partnershipFitTemplate = applicationBody;
export const partnershipFitMailto = buildMailto(
	partnershipFitSubject,
	partnershipFitTemplate,
);

/** Decision brief used by the organisation hub and fit-check page. */
export const decisionBriefSubject = partnershipFitSubject;
export const decisionBriefTemplate = applicationBody;
export const decisionBriefMailto = partnershipFitMailto;

/**
 * Single source of truth for the Rawkode Academy partner programme.
 *
 * Every page that names the offer, quotes a price or links a contact
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
	includedLabel?: string;
	included: string[];
	excluded: string[];
	notes: string[];
	mailto: string;
}

const applicationBody = [
	"Name:",
	"Company and product:",
	"Developers or platform teams you need to reach:",
	"What you want to help engineers do:",
	"Product, demo, docs or repository:",
	"When you'd like to start:",
].join("\n");

/**
 * Capacity. David does every review and partnership himself, so places are
 * capped. The page prints these numbers as written: update `active` and
 * `asOf` by hand whenever a review starts or a partnership ends, and never
 * lower `places` or raise `active` to manufacture urgency.
 */
export const partnershipCapacity = {
	/** Partners (including first engagements in progress) David works with at once. */
	places: 6,
	/** Places taken today. */
	active: 0,
	/** New first engagements David can start in a calendar month. */
	newStartsPerMonth: 2,
	asOf: "12 October 2026",
	/** Week the next engagement can start, e.g. "2 November 2026". Leave null until known. */
	nextStart: null as string | null,
} as const;

export const partnershipPlacesOpen = Math.max(
	0,
	partnershipCapacity.places - partnershipCapacity.active,
);

export const partnershipIsFull = partnershipPlacesOpen === 0;

/**
 * Current availability, worded for the page. While no places are taken the
 * page states the limits and the booking order rather than a count.
 */
export const partnershipAvailability = partnershipIsFull
	? `All ${partnershipCapacity.places} places are taken as of ${partnershipCapacity.asOf}. Enquire to join the waiting list; places go in the order work is booked.`
	: partnershipCapacity.active > 0
		? `${partnershipPlacesOpen} of ${partnershipCapacity.places} places open as of ${partnershipCapacity.asOf}. Places go in the order work is booked.`
		: `New work starts in the order it's booked, ${partnershipCapacity.newStartsPerMonth} a month. Once ${partnershipCapacity.places} partners are in progress, new work waits for a place.`;

export interface CopyPart {
	text: string;
	href?: string;
}

/**
 * David's background, shown under the hero byline. Parts with an href link to
 * public proof of the claim.
 */
export const partnershipExperience: CopyPart[] = [
	{ text: "I've led DevRel and engineering teams at " },
	{
		text: "Equinix Metal",
		href: "https://blog.equinix.com/blog/author/dmckay/",
	},
	{ text: ", " },
	{ text: "Pulumi", href: "https://www.youtube.com/watch?v=MR8MOJjez2c" },
	{ text: " and " },
	{
		text: "InfluxData",
		href: "https://www.influxdata.com/blog/scaling-kubernetes-deployments-influxdb-flux/",
	},
	{
		text: ", working with engineers on how they discover, adopt and run developer tools.",
	},
];

/** Linux Foundation credentials, each linking to its Credly badge. */
export const partnershipCredentials = [
	{
		label: "KubeCon track chair",
		href: "https://www.credly.com/badges/5055322b-196e-4deb-a85d-3bb9f1663157",
	},
	{
		label: "KubeCon program committee",
		href: "https://www.credly.com/badges/72a586a0-cd70-48d3-bb17-e57481aa0802",
	},
	{
		label: "KubeCon speaker",
		href: "https://www.credly.com/badges/df66413d-2ce5-407d-9505-13f789b4531c",
	},
	{
		label: "cdCon speaker",
		href: "https://www.credly.com/badges/43eec0bd-a543-4e67-9c0c-3bfe081cd042",
	},
] as const;

/** Audience snapshot: vidIQ channel UCrber_mFvp_FEF7D9u8PDEA reported 28,200 on 31 October 2026.
 * Public channel: https://www.youtube.com/@RawkodeAcademy
 * Credentials above link to the published badges.
 */
export const partnershipFacts = [
	"28.2K YouTube subscribers (31 October 2026)",
	"Keynote at KCD UK 2026",
] as const;

/** Real first-look episodes, linked from the hero so buyers can see the work. */
export const partnershipWatchEpisodes = [
	{ label: "Restate", href: "/watch/hands-on-introduction-to-restate" },
	{ label: "SpiceDB", href: "/watch/hands-on-introduction-to-spicedb" },
	{
		label: "Fermyon",
		href: "/watch/hands-on-introduction-to-fermyon-wasm-functions",
	},
] as const;

export const partnershipDescription =
	"Awareness, Adoption, and Support for developer tools. Hands-on content, adoption reviews, docs, community, talks and office hours to help engineers succeed from dev to prod and beyond.";

export interface PartnershipPerk {
	title: string;
	detail: string;
}

/**
 * Extras for ongoing partners. Each is small and bounded so six partners stay
 * deliverable. Anything an audience sees is labelled as partner content.
 */
export const partnershipPerks: PartnershipPerk[] = [
	{
		title: "Community supporter, included",
		detail:
			"Your supporter badge, docs and latest announcement on your technology page and its videos, plus your logo on the supporters wall, for as long as we work together.",
	},
	{
		title: "Practitioner feedback",
		detail:
			"At our monthly working session, we discuss the questions and problems that came up in the agreed work and what your team can do next.",
	},
	{
		title: "Your technology page",
		detail:
			"At the quarterly review, we check your product's Academy technology page and update its links, partner label and the public examples we created together.",
	},
	{
		title: "Newsletter feature",
		detail:
			"One technical update per quarter in the Academy newsletter. We agree the edition and submission deadline in the scope; your team supplies the material for factual review.",
	},
];

/** Extras for partners who continue past their first quarter. */
export const renewalPerks: PartnershipPerk[] = [
	{
		title: "Keep your place",
		detail: "Renewing partners keep their place, ahead of the waiting list.",
	},
	{
		title: "Leads from your sessions",
		detail:
			"Developers who sign up for your session materials can choose to hear from your team. You receive contact details only from those who opt in.",
	},
];

export const partnershipReviewCredit =
	"If we agree an ongoing partnership within 30 days of your first project being delivered, that project can form part of the first quarter's scope. We agree the remaining work and price in writing before you commit.";

/** Awareness: get people interested. */
export const handsOnContentOffer: PartnershipOffer = {
	id: "hands-on-content",
	name: "Hands-on content",
	label: "Awareness",
	price: "$10,000",
	priceShort: "$10k",
	cadence: "A fixed price, over about six weeks.",
	summary:
		"I use your product to tackle real problems from my own work and share the process in public. Engineers see what it does, where it helps and what its limitations are.",
	included: [
		"Two live sessions or recorded builds, each solving a real problem of mine with your product",
		"A written walkthrough with a runnable example repository",
		"Two clips, up to 90 seconds each, cut from the sessions for your team to reuse",
		"A private session on the product and messaging: what was clear, what was confusing and what I'd change",
	],
	excluded: [],
	notes: [
		"One consolidated factual correction round. We agree publication channels and recording reuse rights before starting. Event work is quoted separately.",
	],
	mailto: buildMailto("Hands-on content", applicationBody),
};

/** Adoption: help engineers move from a first try to production. */
export const fitProofReview: PartnershipOffer = {
	id: "product-review",
	name: "Adoption review",
	label: "Adoption",
	price: "$5,000",
	priceShort: "$5k",
	cadence:
		"A fixed price, delivered within 10 business days of getting access.",
	summary:
		"I work through the setup, docs and workflows your engineers need, without a guided demo. We agree how far the review goes, from a first working result to production tasks such as upgrades or recovery. You get the obstacles I found and what to fix first.",
	included: [
		"A written report with reproducible evidence of the obstacles I found in the agreed workflows",
		"A ranked list of what to fix first",
		"A one-hour call to go through it with your team",
	],
	excluded: [],
	notes: [
		"Covers up to two kinds of user, such as a platform team and the application developers they serve. A retest after changes is included only when agreed in the scope.",
	],
	mailto: buildMailto("Adoption review", applicationBody),
};

/** Support: help users stay successful after adoption. */
export const supportOffer: PartnershipOffer = {
	id: "developer-support",
	name: "Developer support",
	label: "Support",
	price: "Quoted to scope",
	priceShort: "Quoted",
	cadence:
		"One project or ongoing work, with deliverables and dates agreed up front.",
	summary:
		"Bring in experienced engineering help for the work your team needs to deliver next: docs, examples, technical sessions and answers to recurring user questions.",
	includedLabel: "Work can include",
	included: [
		"Writing and improving docs, guides and runnable examples",
		"Community participation, technical discussions and Q&A",
		"Regular office hours to answer questions and work through problems",
		"Public speaking, conference workshops and customer training",
		"Tutorials, live sessions and practical troubleshooting",
	],
	excluded: [],
	notes: [
		"We agree the audience, outputs, frequency and review rounds before quoting. Your team keeps the agreed docs, examples and learning materials.",
	],
	mailto: buildMailto("Developer support", applicationBody),
};

export type AdoptionStageId = "awareness" | "adoption" | "support";

export interface AdoptionStage {
	id: AdoptionStageId;
	/** Stage name, e.g. "Awareness". */
	stage: string;
	/** What the stage is for, e.g. "Get people interested". */
	tagline: string;
	/** The problem the buyer recognises. */
	problem: string;
	/** Who usually holds the budget for this stage. */
	owner: string;
	offer: PartnershipOffer;
	route: ApplicationPath;
	cta: string;
	ctaName: string;
	ctaLocation: string;
}

/**
 * Three areas of work, each with a relevant offer and enquiry route.
 */
export const adoptionStages: AdoptionStage[] = [
	{
		id: "awareness",
		stage: "Awareness",
		tagline: "Get engineers interested",
		problem: "Show engineers what your product does and why they'd choose it.",
		owner: "Usually marketing, developer relations or demand generation.",
		offer: handsOnContentOffer,
		route: "Hands-on content",
		cta: "Ask about hands-on content",
		ctaName: "ask_about_hands_on_content",
		ctaLocation: "stage-awareness",
	},
	{
		id: "adoption",
		stage: "Adoption",
		tagline: "Help engineers get to production",
		problem:
			"Find and fix what gets in the way between trying your product and relying on it.",
		owner:
			"Usually developer relations, developer experience or product, with product owning the fixes.",
		offer: fitProofReview,
		route: "Adoption review",
		cta: "Ask about an adoption review",
		ctaName: "ask_about_an_adoption_review",
		ctaLocation: "stage-adoption",
	},
	{
		id: "support",
		stage: "Support",
		tagline: "Help users succeed over time",
		problem:
			"Keep helping as their questions, workloads and use of your product grow.",
		owner:
			"Usually developer relations, customer success, education or community.",
		offer: supportOffer,
		route: "Developer support",
		cta: "Ask about developer support",
		ctaName: "ask_about_developer_support",
		ctaLocation: "stage-support",
	},
];

/**
 * Scope is agreed together; public coverage keeps its editorial independence.
 */
export const independenceRules = [
	{
		title: "We agree the scope",
		detail:
			"We agree the audience and the work before starting. For public content, I choose a real use case and show what happens when I build it.",
	},
	{
		title: "My conclusions stay independent",
		detail:
			"You can correct facts before publication. My conclusions stay in, including limitations and problems I find.",
	},
	{
		title: "Paid work is labelled",
		detail:
			"Public work you pay for is clearly labelled. Payment doesn't guarantee viewers, leads or a recommendation.",
	},
] as const;

/** Advice runs through every stage, not as a separate product. */
export const partnershipAdvice =
	"Product and messaging advice comes with every stage. I tell you privately where the product or its explanation got in the way and what I'd change.";

export const ongoingPartnershipOffer: PartnershipOffer = {
	id: "partnership-ongoing",
	name: "Ongoing partnership",
	label: "Ongoing partnership",
	price: "$12,000 a quarter",
	priceShort: "$12k/quarter",
	cadence:
		"Quarter by quarter, or $40,000 for a 12-month contract, billed $10,000 a quarter.",
	summary:
		"Work with me across awareness, adoption and support. We agree each quarter's priorities, deliverables and cadence before the work starts.",
	included: [
		"A quarterly delivery plan with named outputs, dates and review rounds across the areas your team needs",
		"Monthly 60-minute working sessions with written recaps",
		"Questions and feedback in Slack Connect, with response times agreed in the scope",
		"A quarterly read-out and one-page summary of the work, findings, measured changes and next priorities",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Ongoing partnership", applicationBody),
};

/** An illustration, replaced by a priced statement of work for each partner. */
export const ongoingQuarterExample = [
	"An adoption review of one agreed developer workflow, with evidence and ranked fixes",
	"One live session or recorded build on that workflow, with a runnable example repository",
	"Three monthly 60-minute working sessions with written recaps",
	"A retest of the reviewed workflow and a quarterly read-out after your team makes changes",
] as const;

/** A scoped event engagement with production and distribution agreed separately. */
export const eventContentOffer: PartnershipOffer = {
	id: "event-content",
	name: "Event content and hosting",
	label: "Events",
	price: "Quoted per event",
	priceShort: "Quoted",
	cadence: "Preparation, event dates and delivery agreed before booking.",
	summary:
		"Technical interviews, live builds, panels and workshops around your event, with useful material to share afterwards.",
	includedLabel: "Work can include",
	included: [
		"Technical preparation and interview or session planning",
		"Hosting conversations with your engineers, customers or community",
		"Agreed recordings, edited clips or practical examples for your team to reuse",
	],
	excluded: [],
	notes: [
		"The quote specifies session count, production responsibilities, event access, travel, editing, publication channels and reuse rights.",
	],
	mailto: buildMailto("Event content and hosting", applicationBody),
};

export interface PartnershipAddOn {
	id: string;
	title: string;
	price: string;
	detail: string;
	cta: string;
	route: ApplicationPath;
}

/** Larger pieces of work partners can add to an ongoing partnership. */
export const partnershipAddOns: PartnershipAddOn[] = [
	{
		id: "challenge-series",
		title: "Community challenge series",
		price: "From $15,000",
		detail:
			"A hands-on challenge series built around your product, like Advent of Spin for Fermyon, that gets engineers building with it and sharing what they made.",
		cta: "Ask about a challenge series",
		route: "Community challenge series",
	},
];

/** Shared ownership copy for the pricing summary and full terms. */
export const partnershipOwnership =
	"You own the reports and the read-outs. Example repositories are licensed Apache 2.0, so you can use, change and ship them.";

/** Terms buyers, finance and procurement ask about. */
export const partnershipTerms = [
	{
		title: "Book a single project",
		detail:
			"Hands-on content, an adoption review or a support project can be booked on its own. You pay for the agreed scope, keep the agreed deliverables and have no commitment to further work.",
	},
	{
		title: "Renewal",
		detail:
			"Nothing renews automatically. A quarter ends at its read-out, and a 12-month contract ends after a year. If you want to carry on, we agree it in writing.",
	},
	{
		title: "Payment",
		detail: `${partnershipReviewCredit} Ongoing partnerships are $12,000 a quarter, or $40,000 for a 12-month contract billed $10,000 a quarter. Support projects are quoted once the scope is agreed. Prices are fixed in the statement of work, in USD, with 30-day payment terms, and exclude VAT where it applies.`,
	},
	{
		title: "Paperwork",
		detail:
			"A one-page statement of work listing the deliverables and dates, before you sign. It names the contracting entity and the liability cap. We can work under your MSA and sign your NDA.",
	},
	{
		title: "Access and data",
		detail:
			"I work from a trial or sandbox account and don't need production systems or customer data. Review materials are shared with you privately and I delete my copies 90 days after the work ends, or sooner if you ask. Slack Connect is a shared channel your admins control and can close at any time.",
	},
	{
		title: "If I can't make it",
		detail:
			"I do the work myself. If I can't deliver a scheduled item, we move the date together.",
	},
	{
		title: "Ownership",
		detail: `${partnershipOwnership} You can correct facts before anything is published, and reuse published sessions on your own channels.`,
	},
] as const;

/** What the review covers. Answered in the partnerships FAQ. */
export const productReviewScope =
	"We agree the product areas, intended users and workflows to review: a first working result, or production tasks such as a highly available setup, backup and restore or an upgrade. One review can cover up to two user groups, such as a platform team and the application developers they serve, or users of your open-source project and hosted product.";

/** Funding for Academy content, separate from work on a partner's product. */
export const supporterOffer: PartnershipOffer = {
	id: "community-supporter",
	name: "Community supporter",
	label: "Support Rawkode Academy",
	price: "$1,000 a month",
	priceShort: "$1k/month",
	cadence:
		"No minimum term. Or $9,000 for the year: twelve months for the price of nine.",
	summary:
		"Help fund free tutorials, live streams and shows on Rawkode Academy, with your company credited alongside the content.",
	included: [
		"A supporter badge on your Rawkode Academy technology page",
		"Your docs and resources at the top of your technology page",
		"Your latest announcement, one at a time, on your technology page and on every video about your technology",
		"Your logo on the community supporters wall",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Community supporter", applicationBody),
};

/** Compatibility shape for components that render the partnership offers. */
export const partnershipTiers = [
	handsOnContentOffer,
	fitProofReview,
	supportOffer,
	ongoingPartnershipOffer,
] as const;
export const partnershipTierNames = partnershipTiers.map((offer) => offer.name);

/** Options for the application form's preferred route field. */
export const applicationPaths = [
	"Hands-on content",
	"Adoption review",
	"Developer support",
	"Event content and hosting",
	"Ongoing partnership",
	"Community supporter",
	"Community challenge series",
	"Not sure yet",
] as const;
export type ApplicationPath = (typeof applicationPaths)[number];

export const productReviewPath = "Adoption review" satisfies ApplicationPath;
export const notSurePath = "Not sure yet" satisfies ApplicationPath;

/** Plain labels for form values and preselection links. */
export const applicationPathLabels: Record<ApplicationPath, string> = {
	"Hands-on content": handsOnContentOffer.name,
	"Adoption review": fitProofReview.name,
	"Developer support": supportOffer.name,
	"Event content and hosting": eventContentOffer.name,
	"Ongoing partnership": ongoingPartnershipOffer.name,
	"Community supporter": supporterOffer.name,
	"Community challenge series": "Community challenge series",
	"Not sure yet": "Not sure yet",
};

/**
 * Route values from earlier links that still preselect the right option.
 * "First-run review", "Fit & Proof Review" and "Production review" all
 * mean the adoption review;
 * the 90-day and annual plans are now the ongoing partnership.
 */
export const legacyApplicationPaths: Record<string, ApplicationPath> = {
	"Product review": "Adoption review",
	"Customer workshops": "Developer support",
	"Adoption Advisory": "Ongoing partnership",
	"90-day partnership": "Ongoing partnership",
	"Annual plan": "Ongoing partnership",
	"Annual partnership": "Ongoing partnership",
	"Production review": "Adoption review",
	"First-run review": "Adoption review",
	"Fit & Proof Review": "Adoption review",
};

/** Resolve a ?route= value, including legacy names, to a current path. */
export const resolveApplicationPath = (
	value: string | null | undefined,
): ApplicationPath | undefined => {
	if (!value) return undefined;
	if ((applicationPaths as readonly string[]).includes(value)) {
		return value as ApplicationPath;
	}
	return Object.hasOwn(legacyApplicationPaths, value)
		? legacyApplicationPaths[value]
		: undefined;
};

/** General partnership application mailto used as a fallback. */
export const partnershipFitSubject = "Rawkode Academy partnership";
export const partnershipFitTemplate = applicationBody;
export const partnershipFitMailto = buildMailto(
	partnershipFitSubject,
	partnershipFitTemplate,
);

/** Decision brief used by the organisation hub and fit-check page. */
export const decisionBriefSubject = partnershipFitSubject;
export const decisionBriefTemplate = applicationBody;
export const decisionBriefMailto = partnershipFitMailto;

/**
 * A short brief the buyer can send to whoever signs off the budget. The
 * mailto has no recipient so they choose who it goes to.
 */
const teamBriefBody = [
	"Rawkode Academy can help engineers discover our product, adopt it and stay successful with it.",
	"",
	"David Flanagan works with developer tool companies on Awareness, Adoption, and Support:",
	"",
	`- Awareness: ${handsOnContentOffer.name}, ${handsOnContentOffer.price}. Two practical sessions, a walkthrough, a runnable repository and two clips. Paid content is labelled and conclusions stay independent.`,
	`- Adoption: ${fitProofReview.name}, ${fitProofReview.price}, delivered within 10 business days of getting access. A review of an agreed journey, from first try to production tasks, with a ranked list of what to fix.`,
	`- Support: ${supportOffer.price}. Docs, community participation, public speaking, conference workshops and office hours to help our users after adoption. We agree deliverables and frequency up front.`,
	"",
	`For ongoing work: ${ongoingPartnershipOffer.name}, ${ongoingPartnershipOffer.price}, or $40,000 for a 12-month contract billed $10,000 a quarter. Each quarter has an agreed scope. We can start here directly. ${partnershipReviewCredit}`,
	"",
	"Event content and technical hosting are quoted per event, including agreed preparation, production, publication and reuse rights.",
	"",
	"Fixed prices in USD, nothing renews automatically and we own the reports and read-outs.",
	"",
	"Details: https://rawkode.academy/organizations/partnerships",
].join("\n");

export const teamBriefMailto = `mailto:?subject=${encodeURIComponent("Working with Rawkode Academy")}&body=${encodeURIComponent(teamBriefBody.replace(/\n/g, "\r\n"))}`;

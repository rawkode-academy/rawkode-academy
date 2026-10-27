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
	"Developers or platform teams you need to reach:",
	"Where they get stuck today (finding you, first success, production, or after that):",
	"Product, demo, docs, or repository:",
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
	{ text: ", so I know what your team can change in a quarter." },
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

/** Short facts listed in the hero byline. The last is the most recent talk, until there is an events calendar. */
export const partnershipFacts = [
	"25 years building software",
	"Former CNCF Ambassador",
	"28.2K YouTube subscribers",
	"Over 450 hours of developer education",
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
	"I work with developer tool companies wherever their engineers get stuck: finding the product, getting it working, running it in production, or getting better with it. Start with a $10,000 field report, a $5,000 review or a customer workshop, then carry on quarter by quarter if it's useful.";

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
			"Your supporter badge, docs and latest announcement on your technology page and its videos, and your logo on the supporters wall, for as long as we work together.",
	},
	{
		title: "Field insight",
		detail:
			"I'm at 30 events a year. Each quarter, I share what engineers in your space are asking about and getting stuck on, gathered at conferences, user groups, live chat and across social.",
	},
	{
		title: "Feature launch health check",
		detail:
			"Before one launch a quarter, I go through the new feature or quick start and share my take: what will land with developers, what to sharpen, and how I'd position it. Give me 10 business days' notice.",
	},
	{
		title: "Demo and talk coaching",
		detail:
			"Before your next launch or conference talk, I run through your demo the way your audience will, and give you notes from over 450 hours of developer education to make it land.",
	},
	{
		title: "Results summary",
		detail:
			"At the end of each quarter, I send you a one-page summary of what changed and how developers now experience your product, with a five-minute video walking through it. It's ready to forward to your CEO or board.",
	},
	{
		title: "Partner round table",
		detail:
			"Once a quarter, partners bring their questions and get answers from me and from other teams solving the same problems.",
	},
	{
		title: "Your example in the Academy",
		detail:
			"The runnable examples I write for you are featured on your product's Rawkode Academy technology page and in any matching course, so engineers find them while they're learning.",
	},
	{
		title: "Your technology page",
		detail:
			"I keep your product's page in the Rawkode Academy technology catalogue accurate and current, and mark you as a partner.",
	},
	{
		title: "Newsletter feature",
		detail:
			"Every month, your team's latest technical work, such as a release, a tutorial or a live session, is featured in the Rawkode Academy newsletter.",
	},
];

/** Extras for partners who continue past their first quarter. */
export const renewalPerks: PartnershipPerk[] = [
	{
		title: "Keep your place",
		detail: "Renewing partners keep their place, ahead of the waiting list.",
	},
	{
		title: "Guest article",
		detail:
			"Your team publishes a technical article on Rawkode Academy, edited by me so it reads well and lands with engineers.",
	},
	{
		title: "Leads from your sessions",
		detail:
			"Developers who sign up for your session materials can opt in to hear from your team, so you get warm leads from engineers who've already seen your product work.",
	},
];

export const partnershipReviewCredit =
	"What you pay for a first engagement counts towards an ongoing partnership when it is signed within 30 days of the work being delivered.";

/** Stage 1: engineers haven't found you, or don't see why they'd need you. */
export const fieldReportOffer: PartnershipOffer = {
	id: "field-report",
	name: "Field report",
	label: "Getting found",
	price: "$10,000",
	priceShort: "$10k",
	cadence: "A fixed price, over about six weeks.",
	summary:
		"I pick real problems from my own work and solve them with your product, in public. Engineers see a practitioner reach for your tool because it helped, not because of a script.",
	included: [
		"Two live sessions or recorded builds, each solving a real problem of mine with your product",
		"A written walkthrough with a runnable example repository",
		"Short clips cut from the sessions",
		"A private session on your messaging and product: where the words lost me, and where I worked around the product",
	],
	excluded: [],
	notes: [
		"Hosting at your event or booth, published on your channels, is quoted per event.",
	],
	mailto: buildMailto("Field report", applicationBody),
};

/** Stage 2: engineers try the product and give up before it works. */
export const fitProofReview: PartnershipOffer = {
	id: "product-review",
	name: "Getting-started review",
	label: "First success",
	price: "$5,000",
	priceShort: "$5k",
	cadence:
		"A fixed price, delivered within 10 business days of getting access.",
	summary:
		"I work through your product alone as your target user, with nobody to rescue me, and tell you where engineers get stuck and what to fix first.",
	included: [
		"A written report showing the places engineers get stuck",
		"A ranked list of what to fix first",
		"A one-hour call to go through it with your team",
	],
	excluded: [],
	notes: [
		"Covers up to two kinds of user, such as a platform team and the application developers they serve.",
	],
	mailto: buildMailto("Getting-started review", applicationBody),
};

/** Stage 3: engineers get it working, then stall before running it for real. */
export const productionReviewOffer: PartnershipOffer = {
	id: "production-review",
	name: "Production review",
	label: "Production",
	price: "$5,000",
	priceShort: "$5k",
	cadence:
		"A fixed price, delivered within 10 business days of getting access.",
	summary:
		"The same review, aimed at the path to production: a highly available setup, an upgrade, a backup and restore, or the move from your open-source project to your paid product.",
	included: [
		"A written report showing where the path to production breaks down",
		"A ranked list of what to fix, explain or teach first",
		"A one-hour call to go through it with your team",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Production review", applicationBody),
};

/** Stage 4: users run the product and need to get better at it. */
export const workshopOffer: PartnershipOffer = {
	id: "customer-workshops",
	name: "Customer workshops",
	label: "Keeping users",
	price: "Quoted per workshop",
	priceShort: "Quoted",
	cadence: "Scoped with you: format, length and audience.",
	summary:
		"Hands-on workshops for your customers and community, and troubleshooting sessions where engineers fix something broken with your product.",
	included: [
		"A hands-on workshop for your customers or community, live or recorded",
		"Lab material your team keeps and can run again",
		"Troubleshooting sessions on Rawkode Live in the Klustered format",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Customer workshops", applicationBody),
};

export type AdoptionStageId =
	| "discover"
	| "first-success"
	| "production"
	| "keep";

export interface AdoptionStage {
	id: AdoptionStageId;
	/** Short stage name, e.g. "Getting found". */
	stage: string;
	/** The problem the buyer recognises. */
	problem: string;
	/** Who usually holds the budget for this stage. */
	owner: string;
	offer: PartnershipOffer;
	route: ApplicationPath;
	cta: string;
	ctaLocation: string;
}

/**
 * The four ways in. Each stage is a different problem with a different
 * budget holder; a buyer starts wherever their engineers are stuck.
 */
export const adoptionStages: AdoptionStage[] = [
	{
		id: "discover",
		stage: "Getting found",
		problem:
			"Engineers haven't heard of you, or don't see why they'd reach for you.",
		owner: "Usually marketing, developer relations or demand generation.",
		offer: fieldReportOffer,
		route: "Field report",
		cta: "Ask about a field report",
		ctaLocation: "stage-discover",
	},
	{
		id: "first-success",
		stage: "First success",
		problem: "Engineers try you and give up before it works.",
		owner:
			"Usually developer relations or developer experience, with product owning the fixes.",
		offer: fitProofReview,
		route: "Product review",
		cta: "Ask about a getting-started review",
		ctaLocation: "stage-first-success",
	},
	{
		id: "production",
		stage: "Production",
		problem: "Engineers get it working, then stall before running it for real.",
		owner: "Usually product or solutions engineering.",
		offer: productionReviewOffer,
		route: "Production review",
		cta: "Ask about a production review",
		ctaLocation: "stage-production",
	},
	{
		id: "keep",
		stage: "Keeping users",
		problem: "Your users run you in production and need to get better at it.",
		owner: "Usually customer success, education or community.",
		offer: workshopOffer,
		route: "Customer workshops",
		cta: "Ask about workshops",
		ctaLocation: "stage-keep",
	},
];

/**
 * Rules that apply to every paid piece of work, whatever the stage. They are
 * why the work is worth paying for, so the page states them plainly.
 */
export const independenceRules = [
	{
		title: "I pick the problem",
		detail:
			"You tell me what you want engineers to be able to do. I choose the real problems and use cases I work on.",
	},
	{
		title: "You don't approve what I publish",
		detail:
			"You can correct facts before anything goes out. What I conclude stays in, including where your product wasn't the right tool.",
	},
	{
		title: "Paid work is labelled",
		detail:
			"Anything an audience sees that you paid for says so, on screen and in the description. No promised viewers, leads or positive coverage.",
	},
] as const;

/** Advice runs through every stage, not as a separate product. */
export const partnershipAdvice =
	"Product and messaging advice comes with every stage. You hear privately what I'd change, before and after the public work.";

export const ongoingPartnershipOffer: PartnershipOffer = {
	id: "partnership-ongoing",
	name: "Ongoing partnership",
	label: "Keep going",
	price: "$12,000 a quarter",
	priceShort: "$12k/quarter",
	cadence:
		"Quarter by quarter, or $40,000 for a 12-month contract, billed $10,000 a quarter.",
	summary:
		"Keep working together across stages. Each quarter, you choose what I work on next.",
	included: [
		"Each quarter, one piece of stage work: a field report, a review, or a customer workshop",
		"Monthly 60-minute working sessions with written recaps",
		"Slack Connect with me",
		"A read-out each quarter on what changed, where we choose the next quarter's work",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Ongoing partnership", applicationBody),
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

/** Terms buyers, finance and procurement ask about. */
export const partnershipTerms = [
	{
		title: "Stop after the first engagement",
		detail:
			"A field report, a review or a workshop is priced on its own. Stop there and that's all you pay. You keep everything it produced. There is nothing to cancel.",
	},
	{
		title: "Renewal",
		detail:
			"Nothing renews automatically. A quarter ends at its read-out, and a 12-month contract ends after a year. If you want to carry on, we agree it in writing.",
	},
	{
		title: "Payment",
		detail: `${partnershipReviewCredit} Ongoing partnerships are $12,000 a quarter, or $40,000 for a 12-month contract billed $10,000 a quarter. All prices are fixed and in USD, with 30-day payment terms, and exclude VAT where it applies.`,
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
		detail:
			"You own the reports and the read-outs. Example repositories are licensed Apache 2.0, so you can use, change and ship them. You can correct facts before anything is published, and reuse published sessions on your own channels.",
	},
] as const;

/** What the review covers. Answered in the partnerships FAQ. */
export const productReviewScope =
	"We agree the product areas, who I'm acting as, and how far I go: a first working result for a getting-started review, or further for a production review, like a highly available setup, a backup and restore, or an upgrade. One review can follow up to two kinds of user, such as a platform team and the application developers they serve, or your open-source project and its hosted product.";

/** A lighter way to back the content, without the stage work. */
export const supporterOffer: PartnershipOffer = {
	id: "community-supporter",
	name: "Community supporter",
	label: "Support Rawkode Academy",
	price: "$1,000 a month",
	priceShort: "$1k/month",
	cadence:
		"No minimum term. Or $9,000 for the year: twelve months for the price of nine.",
	summary:
		"Fund free tutorials, live streams and shows for the community, and thousands of engineers see your name next to the content they learn from.",
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
	fieldReportOffer,
	fitProofReview,
	productionReviewOffer,
	workshopOffer,
	ongoingPartnershipOffer,
] as const;
export const partnershipTierNames = partnershipTiers.map((offer) => offer.name);

/** Options for the application form's preferred route field. */
export const applicationPaths = [
	"Field report",
	"Product review",
	"Production review",
	"Customer workshops",
	"Ongoing partnership",
	"Community supporter",
	"Community challenge series",
	"Not sure yet",
] as const;
export type ApplicationPath = (typeof applicationPaths)[number];

export const productReviewPath = "Product review" satisfies ApplicationPath;
export const notSurePath = "Not sure yet" satisfies ApplicationPath;

/** Plain labels for form values and preselection links. */
export const applicationPathLabels: Record<ApplicationPath, string> = {
	"Field report": fieldReportOffer.name,
	"Product review": fitProofReview.name,
	"Production review": productionReviewOffer.name,
	"Customer workshops": workshopOffer.name,
	"Ongoing partnership": ongoingPartnershipOffer.name,
	"Community supporter": supporterOffer.name,
	"Community challenge series": "Community challenge series",
	"Not sure yet": "Not sure yet",
};

/**
 * Attio Offer option title and USD value for each application route.
 * "Field report" and "Workshop" must exist as Offer options in Attio;
 * workshops are quoted per scope, so their inbound value is 0 until quoted.
 */
export const applicationPathDeals: Record<
	ApplicationPath,
	{ offer: string; valueUsd: number }
> = {
	"Field report": { offer: "Field report", valueUsd: 10000 },
	"Product review": { offer: "Review", valueUsd: 5000 },
	"Production review": { offer: "Review", valueUsd: 5000 },
	"Customer workshops": { offer: "Workshop", valueUsd: 0 },
	"Ongoing partnership": {
		offer: "Partnership (Quarterly)",
		valueUsd: 12000,
	},
	"Not sure yet": { offer: "Review", valueUsd: 5000 },
	"Community supporter": { offer: "Supporter", valueUsd: 9000 },
	"Community challenge series": { offer: "Challenge series", valueUsd: 15000 },
};

/**
 * Route values from earlier links that still preselect the right option.
 * "First-run review" and "Fit & Proof Review" both meant the paid review;
 * the 90-day and annual plans are now the ongoing partnership.
 */
export const legacyApplicationPaths: Record<string, ApplicationPath> = {
	"Adoption Advisory": "Ongoing partnership",
	"90-day partnership": "Ongoing partnership",
	"Annual plan": "Ongoing partnership",
	"Annual partnership": "Ongoing partnership",
	"First-run review": "Product review",
	"Fit & Proof Review": "Product review",
};

/** Resolve a ?route= value, including legacy names, to a current path. */
export const resolveApplicationPath = (
	value: string | null | undefined,
): ApplicationPath | undefined => {
	if (!value) return undefined;
	if ((applicationPaths as readonly string[]).includes(value)) {
		return value as ApplicationPath;
	}
	return legacyApplicationPaths[value];
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
	"I found a way to get engineers further with our product.",
	"",
	"David Flanagan of Rawkode Academy works with developer tool companies at whichever stage engineers get stuck:",
	"",
	`- Getting found: ${fieldReportOffer.name}, ${fieldReportOffer.price}. He solves real problems of his own with our product, in public, labelled as paid, then tells us privately what he'd change.`,
	`- First success: ${fitProofReview.name}, ${fitProofReview.price}, delivered in 10 business days. A ranked list of where engineers get stuck and what to fix first.`,
	`- Production: ${productionReviewOffer.name}, ${productionReviewOffer.price}. The same review, aimed at the path to production.`,
	`- Keeping users: ${workshopOffer.name}, ${workshopOffer.price.toLowerCase()}.`,
	"",
	`Then, if it's useful: ${ongoingPartnershipOffer.name}, ${ongoingPartnershipOffer.price}. ${partnershipReviewCredit}`,
	"",
	"Fixed prices in USD, nothing renews automatically, and we own the reports and read-outs.",
	"",
	"Details: https://rawkode.academy/organizations/partnerships",
].join("\n");

export const teamBriefMailto = `mailto:?subject=${encodeURIComponent("Working with Rawkode Academy")}&body=${encodeURIComponent(teamBriefBody.replace(/\n/g, "\r\n"))}`;

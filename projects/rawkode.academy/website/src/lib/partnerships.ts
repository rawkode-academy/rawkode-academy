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

export interface PartnershipStep {
	when: string;
	what: string;
}

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
	"What would you like to improve:",
	"Product, demo, docs, or repository:",
	"Funding stage and when you'd like to start:",
].join("\n");

/**
 * Capacity. David does every review and partnership himself, so places are
 * capped. The page prints these numbers as written: update `active` and
 * `asOf` by hand whenever a review starts or a partnership ends, and never
 * lower `places` or raise `active` to manufacture urgency.
 */
export const partnershipCapacity = {
	/** Partners (including reviews in progress) David works with at once. */
	places: 6,
	/** Places taken today. */
	active: 0,
	/** New product reviews David can start in a calendar month. */
	newStartsPerMonth: 2,
	asOf: "12 October 2026",
	/** Week the next review can start, e.g. "2 November 2026". Leave null until known. */
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
	? `All ${partnershipCapacity.places} places are taken as of ${partnershipCapacity.asOf}. Apply to join the waiting list; places go in the order reviews are booked.`
	: partnershipCapacity.active > 0
		? `${partnershipPlacesOpen} of ${partnershipCapacity.places} places open as of ${partnershipCapacity.asOf}. Places go in the order reviews are booked.`
		: `Reviews start in the order they're booked, ${partnershipCapacity.newStartsPerMonth} a month. Once ${partnershipCapacity.places} partners are in progress, new reviews wait for a place.`;

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
	{ text: "Equinix Metal", href: "https://blog.equinix.com/blog/author/dmckay/" },
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
	"I work through your developer tool as your target user and tell you where engineers get stuck. You get a written list of what to fix first in 10 business days for $5,000, then a 90-day or annual partnership if it's useful.";

export interface PartnershipPerk {
	title: string;
	detail: string;
}

/**
 * Extras in the full 90 days. Each is small and bounded so six partners stay
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
			"The runnable example I write for you is featured on your product's Rawkode Academy technology page and in any matching course, so engineers find it while they're learning.",
	},
	{
		title: "Your technology page",
		detail:
			"I keep your product's page in the Rawkode Academy technology catalogue accurate and current, and mark you as a partner.",
	},
	{
		title: "Newsletter feature",
		detail:
			"Every month, your team's latest technical work, such as a release, a tutorial or the live session, is featured in the Rawkode Academy newsletter.",
	},
];

/** Extras for partners who continue past the first 90 days. */
export const renewalPerks: PartnershipPerk[] = [
	{
		title: "Keep your place",
		detail:
			"Renewing partners keep their place, ahead of the waiting list.",
	},
	{
		title: "Guest article",
		detail:
			"Your team publishes a technical article on Rawkode Academy, edited by me so it reads well and lands with engineers.",
	},
	{
		title: "Leads from your session",
		detail:
			"Developers who sign up for your live session's materials can opt in to hear from your team, so you get warm leads from engineers who've already seen your product work.",
	},
];

/** The fixed 90-day arc. The review is the first step. */
export const partnershipPlan: PartnershipStep[] = [
	{
		when: "Weeks 1–2 · product review",
		what: "We start with a kick-off call, and you give me a trial or sandbox account. I carry out the product review and deliver the written report within 10 business days, then walk your team through it in a one-hour call.",
	},
	{
		when: "From the start",
		what: "Slack Connect with me for questions and second opinions on launches, docs, demos and roadmap trade-offs.",
	},
	{
		when: "Decide",
		what: "If you sign a 90-day or annual partnership within 30 days of the review being delivered, the $5,000 you paid for it counts towards the cost. You can also stop there. Either way, you keep everything from the review.",
	},
	{
		when: "Month 2",
		what: "Agree the use case to teach. I write the runnable example, your team reviews it, and I run the live session on Rawkode Live or your own webinar, solo or with someone from your team. Monthly working session on the ranked list.",
	},
	{
		when: "Month 3",
		what: "I repeat the review on what you've shipped and check each place engineers got stuck. At the day-90 read-out, we go through what changed and decide what to work on next quarter.",
	},
];

export const partnershipReviewCredit =
	"The $5,000 review counts towards a 90-day or annual partnership when it is signed within 30 days of the review being delivered.";

export const partnershipOffer: PartnershipOffer = {
	id: "partnership-90d",
	name: "Full 90-day partnership",
	label: "Work with Rawkode Academy",
	price: "$12,000",
	priceShort: "$12k/90 days",
	cadence:
		"A fixed price. After a review, continuing costs $7,000 more, paid as $3,500 a month for two months.",
	summary: "The review, then the rest of the 90 days working on what it finds.",
	included: [
		"A live session on Rawkode Live or your own webinar. I can run it solo, or co-host it with someone from your team",
		"One runnable example repository, written by me",
		"Monthly 60-minute working sessions with written recaps",
		"Slack Connect with me",
		"A day-90 review compared with the original, and a read-out on what changed",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("90-day partnership", applicationBody),
};

export const annualPartnershipOffer: PartnershipOffer = {
	id: "partnership-annual",
	name: "Annual partnership",
	label: "Work with Rawkode Academy for a year",
	price: "$40,000 a year",
	priceShort: "$40k/year",
	cadence:
		"Billed $10,000 a quarter. A 12-month contract, and either side can choose not to continue after that.",
	summary:
		"A year of working together: the review to start, then the full 90-day cycle every quarter.",
	included: [
		"The full product review to start the year",
		"Every quarter: a live session on Rawkode Live or your own webinar, with a runnable example repository",
		"Every quarter: a re-run compared with last time, and a read-out",
		"Monthly 60-minute working sessions with me, all year",
		"Slack with me for the whole year",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Annual partnership", applicationBody),
};

export interface PartnershipAddOn {
	id: string;
	title: string;
	price: string;
	detail: string;
	cta: string;
	route: ApplicationPath;
}

/** Larger pieces of work partners can add to a 90-day or annual partnership. */
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
		title: "Stop after the review",
		detail:
			"The review is the first step and is priced on its own. It is invoiced when I deliver it, not before. If you stop there you have paid $5,000 and keep the review and written report. There is nothing to cancel.",
	},
	{
		title: "Renewal",
		detail:
			"Nothing renews automatically. A 90-day partnership ends at day 90, and an annual partnership ends after a year, with a review each quarter. If you want to carry on, we agree it in writing.",
	},
	{
		title: "Invoicing",
		detail: `The review is invoiced on delivery. ${partnershipReviewCredit} For the 90-day partnership, the remaining $7,000 is invoiced as two monthly payments of $3,500. The annual partnership is billed at $10,000 a quarter. All prices are fixed and in USD, with 30-day payment terms, and exclude VAT where it applies.`,
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
			"You own the review, the report and the read-out. The example repository is licensed Apache 2.0, so you can use, change and ship it. You approve the session title and use case, can reuse the published session on your own channels, and can ask me to unlist it.",
	},
] as const;

/** First step of every partnership, independently useful. */
export const fitProofReview: PartnershipOffer = {
	id: "product-review",
	name: "Product review",
	label: "Step one",
	price: "$5,000",
	priceShort: "$5k",
	cadence:
		"A fixed price, delivered within 10 business days of getting access.",
	summary:
		"The first step of every partnership, and useful on its own: a written report you can act on whether or not you continue.",
	included: [
		"A written report showing the places engineers get stuck",
		"A ranked list of what to fix first",
		"A one-hour call to go through it with your team",
	],
	excluded: [],
	notes: [
		"Covers up to two kinds of user, such as a platform team and the application developers they serve.",
	],
	mailto: buildMailto("Product review request", applicationBody),
};

/** What the review covers. Answered in the partnerships FAQ. */
export const productReviewScope =
	"We agree the product areas, who I'm acting as, and how far I go: a first working result, or further, like a highly available setup, a backup and restore, or an upgrade. One review can follow up to two kinds of user, such as a platform team and the application developers they serve, or your open-source project and its hosted product.";

/** A lighter way to back the content, without the review work. */
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
	partnershipOffer,
	annualPartnershipOffer,
] as const;
export const partnershipTierNames = partnershipTiers.map((offer) => offer.name);

/** Options for the application form's preferred route field. */
export const applicationPaths = [
	"Product review",
	"90-day partnership",
	"Annual plan",
	"Community supporter",
	"Community challenge series",
	"Not sure yet",
] as const;
export type ApplicationPath = (typeof applicationPaths)[number];

export const productReviewPath = "Product review" satisfies ApplicationPath;

/** Plain labels for form values and preselection links. */
export const applicationPathLabels: Record<ApplicationPath, string> = {
	"Product review": fitProofReview.name,
	"90-day partnership": partnershipOffer.name,
	"Annual plan": annualPartnershipOffer.name,
	"Community supporter": supporterOffer.name,
	"Community challenge series": "Community challenge series",
	"Not sure yet": "Not sure yet",
};

/** Attio Offer option title and USD value for each application route. */
export const applicationPathDeals: Record<
	ApplicationPath,
	{ offer: string; valueUsd: number }
> = {
	"Product review": { offer: "Review", valueUsd: 5000 },
	"Not sure yet": { offer: "Review", valueUsd: 5000 },
	"90-day partnership": {
		offer: "Partnership (Quarterly)",
		valueUsd: 12000,
	},
	"Annual plan": { offer: "Partnership (Yearly)", valueUsd: 40000 },
	"Community supporter": { offer: "Supporter", valueUsd: 9000 },
	"Community challenge series": { offer: "Challenge series", valueUsd: 15000 },
};

/**
 * Route values from earlier links that still preselect the right option.
 * "First-run review" and "Fit & Proof Review" both meant the paid review.
 */
export const legacyApplicationPaths: Record<string, ApplicationPath> = {
	"Adoption Advisory": "90-day partnership",
	"Annual partnership": "Annual plan",
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
	"I found a way to see exactly where engineers get stuck with our product.",
	"",
	"David Flanagan of Rawkode Academy works through it as our target user and gives us a ranked list of what to fix first.",
	"",
	`Product review: ${fitProofReview.price}, fixed, delivered in 10 business days. ${partnershipReviewCredit}`,
	`90-day partnership: ${partnershipOffer.price}. Annual partnership: ${annualPartnershipOffer.price}.`,
	"",
	"The 90 days:",
	"- Weeks 1-2: the product review and a walkthrough call",
	"- Month 2: a live session and a runnable example for one use case",
	"- Month 3: a re-run of the review and a read-out on what changed",
	"",
	"Fixed prices in USD, nothing renews automatically, it runs on a trial or sandbox account, and we own the review, the report and the read-out.",
	"",
	"Details: https://rawkode.academy/organizations/partnerships",
].join("\n");

export const teamBriefMailto = `mailto:?subject=${encodeURIComponent("Developer product review with Rawkode Academy")}&body=${encodeURIComponent(teamBriefBody.replace(/\n/g, "\r\n"))}`;

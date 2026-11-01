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

const supportApplicationBody = [
	"Name:",
	"Company:",
	"Why you want to support the Academy's free education:",
	"Website or technology page:",
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
	"Work with David across Awareness, Adoption, and Support to help engineers discover, adopt and succeed with your product.";

export const supportOurWorkDescription =
	"Support Rawkode Academy's free developer education. Help engineers learn through practical tutorials, live streams and shows, with clear recognition for your company.";

export interface PartnershipPerk {
	title: string;
	detail: string;
}

export const partnershipPerks: PartnershipPerk[] = [
	{
		title: "Practitioner feedback",
		detail:
			"We use our monthly working session to discuss what came up in the work and what your team can do next.",
	},
	{
		title: "Your technology page",
		detail:
			"Your Academy technology page carries your partner badge, docs and the examples we create together. We check it at the quarterly review.",
	},
	{
		title: "Newsletter feature",
		detail:
			"One technical update per quarter, with the edition, material and submission deadline agreed in the scope.",
	},
];

export interface AdoptionStage {
	id: "awareness" | "adoption" | "support";
	stage: string;
	tagline: string;
	summary: string;
	activities: string[];
}

/** Areas of work within the partnership, chosen to suit the agreed priorities. */
export const adoptionStages: AdoptionStage[] = [
	{
		id: "awareness",
		stage: "Awareness",
		tagline: "Get engineers interested",
		summary:
			"Show engineers what your product can do through real problems and honest technical work.",
		activities: [
			"Practical builds and live sessions",
			"Walkthroughs, runnable examples and reusable clips",
		],
	},
	{
		id: "adoption",
		stage: "Adoption",
		tagline: "Help engineers get to production",
		summary:
			"Work through the experience from a first try to production and find what gets in the way.",
		activities: [
			"Hands-on reviews of agreed developer workflows",
			"Reproducible findings, ranked fixes and scoped retests",
		],
	},
	{
		id: "support",
		stage: "Support",
		tagline: "Help users succeed over time",
		summary:
			"Bring in experienced engineering help for the education and answers your users need next.",
		activities: [
			"Docs, guides, runnable examples and community Q&A",
			"Office hours, talks, conference workshops and customer education",
		],
	},
];

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

export const supporterIndependenceRules = [
	{
		title: "Support funds open education",
		detail:
			"Support helps keep tutorials, live streams and shows free. It does not set their topics or give a company control over the work.",
	},
	{
		title: "Recognition is labelled",
		detail:
			"Supporter badges, logos and other paid recognition are clearly labelled as support for the Academy.",
	},
	{
		title: "Conclusions stay independent",
		detail:
			"David decides what he publishes and keeps his own conclusions, including limitations. Funding does not buy an endorsement or recommendation.",
	},
] as const;

export const partnershipAdvice =
	"We choose the work your users need and agree the priorities, outputs and cadence for each quarter.";

export const supportAcademyOffer: PartnershipOffer = {
	id: "support-our-work",
	name: "Support Our Work",
	label: "Support Our Work",
	price: "$1,000 a month",
	priceShort: "$1k/month",
	cadence: "No minimum term. Or $9,000 for twelve months, agreed up front.",
	summary:
		"Help fund free tutorials, live streams and shows for cloud native engineers, with your company credited alongside the work.",
	included: [
		"One livestream with David for each of the first ten companies to become supporters, with the topic and date agreed together",
		"Access to one shared monthly live Q&A with David for all current supporters",
		"A supporter badge and docs links on your Academy technology page",
		"Your latest announcement, one at a time, on your technology page and its videos",
		"Your logo on the community supporters wall",
	],
	excluded: [],
	notes: [
		"Support funds the Academy's free education. Paid placements are labelled and editorial conclusions stay independent.",
	],
	mailto: buildMailto("Support Our Work", supportApplicationBody),
};

export const ongoingPartnershipOffer: PartnershipOffer = {
	id: "partnership",
	name: "Partnership",
	label: "Partnership",
	price: "$12,000 a quarter",
	priceShort: "$12k/quarter",
	cadence:
		"Quarter by quarter, or $40,000 for a 12-month contract, billed $10,000 a quarter.",
	summary:
		"Work with me across Awareness, Adoption, and Support. Each quarter has a focused plan built around what your users and your team need.",
	included: [
		"An agreed delivery plan with named outputs, dates and review rounds",
		"Monthly 60-minute working sessions with written recaps",
		"Questions and feedback in Slack Connect, with response times agreed in the scope",
		"A quarterly read-out and one-page summary of the work, findings, measured changes and next priorities",
	],
	excluded: [],
	notes: [
		"The plan sets how much work we do in each area. We agree the scope before you commit.",
	],
	mailto: buildMailto("Partnership", applicationBody),
};

/** An illustration of the partnership, replaced by the agreed statement of work. */
export const ongoingQuarterExample = [
	"An adoption review of one agreed developer workflow, with evidence and ranked fixes",
	"One live session or recorded build on that workflow, with a runnable example repository",
	"Three monthly 60-minute working sessions with written recaps",
	"A retest of the reviewed workflow and a quarterly read-out after your team makes changes",
] as const;

export const bespokeProjectOffer: PartnershipOffer = {
	id: "bespoke-project",
	name: "Bespoke project",
	label: "Bespoke projects",
	price: "Quoted to scope",
	priceShort: "Quoted",
	cadence:
		"A defined project, with deliverables, dates and a fixed quote agreed before booking.",
	summary:
		"For an event, a particular piece of technical work or a project that needs its own scope.",
	includedLabel: "Work can include",
	included: [
		"Event interviews, technical hosting, live builds, panels and workshops",
		"Commissioned docs, technical content or training",
		"A specific community or education project",
	],
	excluded: [],
	notes: [
		"We agree preparation, production, access, travel, editing, publication channels and reuse rights where relevant.",
	],
	mailto: buildMailto("Bespoke project", applicationBody),
};

export const communityChallengeOffer: PartnershipOffer = {
	id: "challenge-series",
	name: "Community challenge series",
	label: "Community challenges",
	price: "From $15,000",
	priceShort: "From $15k",
	cadence:
		"Format, production, delivery and participant support are scoped together.",
	summary:
		"A hands-on challenge series built around your product, like Advent of Spin for Fermyon, that gets engineers building and sharing what they make.",
	includedLabel: "Agreed in the scope",
	included: [
		"Challenge format and technical scenarios",
		"Production, hosting and participant support",
		"Reusable materials and a results read-out",
	],
	excluded: [],
	notes: [],
	mailto: buildMailto("Community challenge series", applicationBody),
};

export const partnershipAddOns = [
	{
		id: communityChallengeOffer.id,
		title: communityChallengeOffer.name,
		price: communityChallengeOffer.price,
		detail: communityChallengeOffer.summary,
		cta: "Ask about a challenge series",
		route: "Community challenge series" as const,
	},
] as const;

export const partnershipOwnership =
	"You own the reports and the read-outs. Example repositories are licensed Apache 2.0, so you can use, change and ship them.";

export const partnershipTerms = [
	{
		title: "Scope",
		detail:
			"We agree the quarterly work, outputs and dates before you commit. Bespoke projects and community challenges have their own fixed quotes.",
	},
	{
		title: "Renewal",
		detail:
			"Nothing renews automatically. A quarterly agreement ends after its quarter and an annual agreement after its year. We agree any continuation in writing.",
	},
	{
		title: "Payment",
		detail:
			"Partnerships are $12,000 a quarter, or $40,000 for a 12-month contract billed $10,000 a quarter. Prices are fixed in the statement of work, in USD, with 30-day payment terms, and exclude VAT where it applies.",
	},
	{
		title: "Paperwork",
		detail:
			"A one-page statement of work lists the deliverables and dates, contracting entity and liability cap. We can work under your MSA and sign your NDA.",
	},
	{
		title: "Access and data",
		detail:
			"I work from a trial or sandbox account and don't need production systems or customer data. Review materials stay private and I delete my copies 90 days after the work ends, or sooner if you ask. Your admins control the shared Slack channel.",
	},
	{
		title: "Ownership",
		detail: `${partnershipOwnership} We agree recording reuse rights and factual review before publication.`,
	},
] as const;

export const productReviewScope =
	"Within the partnership, we agree the product areas, intended users and workflows to review, from a first working result to production tasks such as backup and restore or upgrades. The plan defines the evidence, fixes and any later retest.";

export const partnershipTiers = [
	supportAcademyOffer,
	ongoingPartnershipOffer,
	bespokeProjectOffer,
	communityChallengeOffer,
] as const;
export const partnershipTierNames = partnershipTiers.map((offer) => offer.name);

export const applicationPaths = [
	"Support Our Work",
	"Partnership",
	"Bespoke project",
	"Community challenge series",
	"Not sure yet",
] as const;
export type ApplicationPath = (typeof applicationPaths)[number];
export const productReviewPath = "Partnership" satisfies ApplicationPath;
export const notSurePath = "Not sure yet" satisfies ApplicationPath;

export const applicationPathLabels: Record<ApplicationPath, string> = {
	"Support Our Work": supportAcademyOffer.name,
	Partnership: ongoingPartnershipOffer.name,
	"Bespoke project": bespokeProjectOffer.name,
	"Community challenge series": communityChallengeOffer.name,
	"Not sure yet": "Not sure yet",
};

/** Older shared links select the current offer rather than resurrecting old packages. */
export const legacyApplicationPaths: Record<string, ApplicationPath> = {
	"Product review": "Partnership",
	"Adoption review": "Partnership",
	"First-run review": "Partnership",
	"Fit & Proof Review": "Partnership",
	"Production review": "Partnership",
	"Hands-on content": "Partnership",
	"Developer support": "Partnership",
	"Ongoing partnership": "Partnership",
	"Adoption Advisory": "Partnership",
	"90-day partnership": "Partnership",
	"Annual plan": "Partnership",
	"Annual partnership": "Partnership",
	"Event content and hosting": "Bespoke project",
	"Customer workshops": "Bespoke project",
	"Support the Academy": "Support Our Work",
	"Community Support": "Support Our Work",
	"Community supporter": "Support Our Work",
};

export const resolveApplicationPath = (
	value: string | null | undefined,
): ApplicationPath | undefined => {
	if (!value) return undefined;
	if ((applicationPaths as readonly string[]).includes(value))
		return value as ApplicationPath;
	return Object.hasOwn(legacyApplicationPaths, value)
		? legacyApplicationPaths[value]
		: undefined;
};

export const partnershipFitSubject = "Rawkode Academy partnership";
export const partnershipFitTemplate = applicationBody;
export const partnershipFitMailto = buildMailto(
	partnershipFitSubject,
	partnershipFitTemplate,
);
export const decisionBriefSubject = partnershipFitSubject;
export const decisionBriefTemplate = applicationBody;
export const decisionBriefMailto = partnershipFitMailto;

const partnershipBriefBody = [
	"Rawkode Academy Partnership",
	"",
	"David Flanagan works alongside our team across Awareness, Adoption, and Support. We agree the priorities, outputs and cadence each quarter.",
	"",
	`${ongoingPartnershipOffer.price}, or $40,000 for a 12-month contract billed $10,000 a quarter.`,
	...ongoingPartnershipOffer.included.map((item) => `- ${item}`),
	"",
	"An illustrative quarter combines an adoption review, one practical session with a runnable repository, monthly working sessions and a scoped retest. The actual work is agreed before signing.",
	"We agree the starting point, useful measures and data responsibilities, then report findings and observed changes at the read-out.",
	"",
	"Bespoke projects, including events, are quoted to scope. Community challenge series start at $15,000 and have a separate scope.",
	"Nothing renews automatically. Prices are in USD and exclude VAT where it applies.",
	"",
	"Details: https://rawkode.academy/organizations/partnerships",
].join("\n");
export const teamBriefMailto = `mailto:?subject=${encodeURIComponent("Rawkode Academy Partnership")}&body=${encodeURIComponent(partnershipBriefBody.replace(/\n/g, "\r\n"))}`;

const supportBriefBody = [
	"Support Our Work at Rawkode Academy",
	"",
	supportAcademyOffer.summary,
	`${supportAcademyOffer.price}, or $9,000 for twelve months, agreed up front.`,
	...supportAcademyOffer.included.map((item) => `- ${item}`),
	...supportAcademyOffer.notes,
	"",
	"Details: https://rawkode.academy/organizations/support-our-work",
].join("\n");
export const supportBriefMailto = `mailto:?subject=${encodeURIComponent("Support Our Work at Rawkode Academy")}&body=${encodeURIComponent(supportBriefBody.replace(/\n/g, "\r\n"))}`;

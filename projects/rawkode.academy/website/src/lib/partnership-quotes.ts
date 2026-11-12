/**
 * Quotes on the partnerships page are verbatim excerpts of testimonials in
 * the platform-testimonials service. `src/tests/partnership-quotes.test.ts` checks
 * every excerpt against its testimonial, so an edited testimonial fails CI
 * instead of misquoting anyone on the live page.
 */

export const partnershipPullQuoteId = "solomon-hykes";

export const partnershipQuoteExcerpts = {
	"solomon-hykes":
		"As a builder, watching someone use your product in real time is one of the most useful things you can do.",
	"reggie-wilkerson":
		"His deep expertise in the cloud native landscape has helped us refine our product positioning, create compelling demo videos, and confidently navigate the market.",
	"jens-neuse":
		"It was great to see him explore WunderGraph for the first time, especially to see the excitement when we were combining APIs, first with GraphQL and then with TypeScript.",
	"mikkel-hegnhoj":
		"We've seen notable results in developers joining our community and using our services.",
} as const;

export type PartnershipQuoteId = keyof typeof partnershipQuoteExcerpts;

/** Context lines for the quote cards below pricing, in display order. */
export const partnershipQuoteContext = {
	"reggie-wilkerson": "On advisory work: positioning and demos",
	"jens-neuse": "On David's public walkthrough of WunderGraph on Rawkode Live",
	"mikkel-hegnhoj": "On Advent of Spin, built for Fermyon",
} as const satisfies Partial<Record<PartnershipQuoteId, string>>;

const normaliseQuote = (text: string) =>
	text.replace(/\s+/g, " ").trim().toLowerCase();

/** True when `excerpt` appears word for word in `quote`, ignoring whitespace and case. */
export const isVerbatimExcerpt = (quote: string, excerpt: string) =>
	normaliseQuote(quote).includes(normaliseQuote(excerpt));

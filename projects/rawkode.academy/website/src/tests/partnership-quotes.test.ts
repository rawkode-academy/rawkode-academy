import { describe, expect, it } from "vitest";
import {
	isVerbatimExcerpt,
	partnershipPullQuoteId,
	partnershipQuoteContext,
	partnershipQuoteExcerpts,
} from "@/lib/partnership-quotes";

// Testimonial quotes as stored in platform-testimonials (the live
// "testimonials" collection the partnership pages render).
const testimonialQuotes: Record<string, string> = {
	"solomon-hykes":
		"Being a guest on Rawkode is always a fun experience. As a builder, watching someone use your product in real time is one of the most useful things you can do. If they're experienced enough to give you useful feedback as they do it, even better. Doing it all in front of a live audience... let's just say you'll be extra productive the day before 😁. Your community will appreciate the transparency and authenticity of an unscripted interaction.\n\nI encourage every builder to join Rawkode Academy if you have the chance. It will make you, and your product, better.\n",
	"reggie-wilkerson":
		"Working with David and Rawkode Academy has been incredibly valuable for our early-stage journey at Guidepad. His deep expertise in the cloud native landscape has helped us refine our product positioning, create compelling demo videos, and confidently navigate the market. The guidance and insights we receive from David consistently elevate our product and strategy, making this partnership truly invaluable. We look forward to continuing this partnership as we evolve and grow in the market.\n",
	"jens-neuse":
		"It was amazing working together with David. It's hard to present a deep tech product, but David is so knowledgeable about the web and everything so we were  having a great conversation and lots of fun. Additionally, I have to compliment David on how fluent he is in exploring a new project and doing live coding. It was great to see him explore WunderGraph for the first time, especially to see the excitement when we were combining APIs, first with GraphQL and then with TypeScript. I think this was an amazing presentation and I would recommend everyone to go on this show and present their work. David is amazing. I'm super thankful for this opportunity.\n",
	"mikkel-hegnhoj":
		"Rawkode Academy has done an amazing job helping developers be introduced to the world of server-side WebAssembly, promoting Spin project and Fermyon Cloud. We've heard from many developers, that the Advent of Spin challenges, created by Rawkode, was the perfect opportunity to get hands-on, and we've seen notable results in developers joining our community and using our services.\n",
};

const readTestimonial = (id: string) => ({
	quote: testimonialQuotes[id] ?? "",
});

describe("partnership quotes", () => {
	for (const [id, excerpt] of Object.entries(partnershipQuoteExcerpts)) {
		it(`${id} is a verbatim excerpt of its testimonial`, () => {
			expect(isVerbatimExcerpt(readTestimonial(id).quote, excerpt)).toBe(true);
		});
	}

	it("every displayed quote has an excerpt", () => {
		expect(Object.keys(partnershipQuoteExcerpts)).toContain(
			partnershipPullQuoteId,
		);
		for (const id of Object.keys(partnershipQuoteContext)) {
			expect(Object.keys(partnershipQuoteExcerpts)).toContain(id);
		}
	});

	it("rejects a paraphrase", () => {
		expect(
			isVerbatimExcerpt(
				"Watching someone use your product live is useful.",
				"Watching someone use your product live is very useful.",
			),
		).toBe(false);
	});
});

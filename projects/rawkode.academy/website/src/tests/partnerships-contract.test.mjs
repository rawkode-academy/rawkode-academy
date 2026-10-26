import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync(
	new URL("../pages/organizations/partnerships/index.astro", import.meta.url),
	"utf8",
);
const form = readFileSync(
	new URL(
		"../components/organizations/PartnershipApplicationForm.vue",
		import.meta.url,
	),
	"utf8",
);
const action = readFileSync(
	new URL("../actions/partnership.ts", import.meta.url),
	"utf8",
);
const partnershipCopy = readFileSync(
	new URL("../lib/partnerships.ts", import.meta.url),
	"utf8",
);
const header = readFileSync(
	new URL("../components/shell/AcademyHeader.astro", import.meta.url),
	"utf8",
);
const logos = readFileSync(
	new URL("../components/organizations/PartnerLogos.astro", import.meta.url),
	"utf8",
);
const quotesModule = readFileSync(
	new URL("../lib/partnership-quotes.ts", import.meta.url),
	"utf8",
);
const letsChat = readFileSync(
	new URL("../pages/organizations/lets-chat.astro", import.meta.url),
	"utf8",
);

test("partnership page follows the approved redesign", () => {
	// Hero: the offer up front, with the facts that decide whether to enquire.
	assert.match(page, /eyebrow="Partnerships"/);
	assert.match(
		page,
		/See exactly where engineers get stuck with your product\./,
	);
	assert.match(
		page,
		/I teach engineers new tools, live and unscripted\. Then I show the teams who build them where engineers get stuck, and what to fix first\./,
	);
	assert.match(page, /<dt>Price<\/dt>/);
	assert.match(page, /<dt>Delivered in<\/dt>/);
	assert.doesNotMatch(page, /invoic|on delivery/i);
	assert.doesNotMatch(
		partnershipCopy
			.match(
				/export const (partnershipDescription|productReviewCompletion) =[^;]+;/g,
			)
			?.join("\n") ?? "",
		/invoic|on delivery/i,
	);
	assert.match(
		page,
		/28\.2K YouTube subscribers · over 450 hours of developer education/,
	);
	assert.match(page, /<ReviewPreview slot="aside" placement="hero" \/>/);
	assert.match(page, /<ReviewPreview placement="inline" \/>/);
	assert.doesNotMatch(
		page,
		/I work with Datum Cloud today, and I've worked with Teleport, Heroku, Microsoft Azure and ngrok\./,
	);

	// One voice: the page speaks as David, in the first person.
	const faqBlock = page.match(/const faqs = \[(.*?)\n\];/s)?.[1];
	assert(faqBlock);
	assert.doesNotMatch(faqBlock, /\bDavid\b|\bhe\b|\bhim\b|\bhimself\b/);
	assert.match(page, /What are you building\?/);
	assert.doesNotMatch(page, /Tell David about your product/);
	assert.match(
		page,
		/I note every place I get stuck against the recording, rank what to fix, explain or teach/,
	);
	assert.match(
		page,
		/if the statement of work isn't signed within seven days, the place is released\./,
	);
	assert.match(page, /answer: productReviewScope/);
	assert.doesNotMatch(page, /Who is this a good fit for\?|How do we stop\?/);

	// Fit.
	assert.match(page, /Teams I work best with/);
	assert.match(
		page,
		/You build developer tools: infrastructure tools, Kubernetes and cloud native projects, cloud platforms or AI infrastructure\./,
	);
	assert.match(page, /You're between seed and Series C\./);
	assert.match(
		page,
		/An engineer can install or sign up for your product and try it, including open-source projects installed from GitHub or Helm\./,
	);

	// Partners: one alphabetical grid, current and past together.
	assert.match(page, /Teams I've worked with/);
	assert.doesNotMatch(page, /Who I've worked with/);
	assert.match(page, /<PartnerLogos variant="grid" \/>/);
	assert.doesNotMatch(page, /showCurrent=\{false\}/);
	assert.match(logos, /localeCompare/);

	// Quotes are verbatim excerpts, checked against the testimonials.
	for (const quoteId of [
		"reggie-wilkerson",
		"jens-neuse",
		"solomon-hykes",
		"mikkel-hegnhoj",
	]) {
		assert.match(quotesModule, new RegExp(`"${quoteId}"`));
	}
	assert.match(page, /isVerbatimExcerpt\(entry\.data\.quote, excerpt\)/);
	assert.doesNotMatch(page, /throw new Error\(`Partnership quote/);

	// Pricing: every card has its own button, and the credit is stated once.
	assert.match(page, /\{partnershipReviewCredit\}/);
	assert.equal(page.match(/partnershipReviewCredit\}/g)?.length, 1);
	assert.match(page, /partnershipCapacity\.places/);
	assert.match(page, /partnershipCapacity\.newStartsPerMonth/);
	assert.match(page, /card\.offer\.included\.map/);
	assert.doesNotMatch(page, /What's not included|Not a fit/);
	for (const [label, location] of [
		["Ask about a product review", "pricing-review"],
		["Ask about the 90-day plan", "pricing-90-day"],
		["Ask about the annual plan", "pricing-annual"],
	]) {
		assert.match(page, new RegExp(`cta: "${label}"`));
		assert.match(page, new RegExp(`ctaLocation: "${location}"`));
	}
	assert.match(page, /data-cta-location=\{card\.ctaLocation\}/);
	assert.deepEqual(
		Array.from(page.matchAll(/data-cta-location="([^"]+)"/g), (m) => m[1]),
		["hero", "hero-watch", "pricing-addon", "pricing-supporter", "pinned"],
	);
	// Every button leads to the same form anchor.
	assert.match(page, /#enquiry-form`/);
	assert.doesNotMatch(page, /href="\?route=|#apply"/);
	assert.doesNotMatch(`${page}\n${header}`, />Book a product review<\/a>/);
	assert.doesNotMatch(
		header,
		/Ask about a product review|data-partnership-cta/,
	);
	assert.match(page, /location: cta\.getAttribute\("data-cta-location"\)/);

	// Pinned mobile bar.
	assert.match(page, /data-partnership-pinned/);
	assert.match(page, /requestAnimationFrame\(update\)/);
	assert.match(page, /prefers-reduced-motion/);

	// Simple terms.
	assert.match(
		page,
		/You decide what each quarter covers, and you own the review, the report and the read-out\./,
	);
	assert.equal(page.match(/Renew when it's working/g)?.length, 1);

	// Wording rules that stay in force.
	assert.doesNotMatch(`${page}\n${partnershipCopy}`, /in order of importance/);
	assert.doesNotMatch(partnershipCopy, /refund/i);
	assert.doesNotMatch(`${page}\n${partnershipCopy}\n${header}`, /champion/i);
	assert.doesNotMatch(page, /unsigned holds|logs every stall/);
	assert.doesNotMatch(
		`${page}\n${partnershipCopy}`,
		/all-partner|all partner|monthly call|partner call/i,
	);
	assert.doesNotMatch(`${page}\n${partnershipCopy}`, /£|US\$/);
	assert.doesNotMatch(
		`${page}\n${partnershipCopy}\n${letsChat}`,
		/two business days/i,
	);
	assert.doesNotMatch(
		`${page}\n${form}\n${letsChat}\n${partnershipCopy}`,
		/replies within|reply within|get back to you within|within 24|within 48/i,
	);
	assert.doesNotMatch(partnershipCopy, /puff piece/);
	assert.doesNotMatch(
		partnershipCopy,
		/warm introductions where they help both sides/,
	);
	assert.doesNotMatch(
		page,
		/id="sample"|<PartnershipProof \/>|See the 90 days/,
	);

	// Shared copy the page reads from.
	assert.match(
		partnershipCopy,
		/If I can't deliver a scheduled item, we move the date together\./,
	);
	assert.match(partnershipCopy, /export const partnershipReviewCredit =/);
	assert.match(
		partnershipCopy,
		/The \$5,000 review counts towards a 90-day or annual partnership when it is signed within 30 days of the review being delivered\./,
	);
	assert.match(partnershipCopy, /price: "\$5,000"/);
	assert.match(partnershipCopy, /price: "\$12,000"/);
	assert.match(partnershipCopy, /price: "\$40,000 a year"/);
	assert.match(
		partnershipCopy,
		/continuing costs \$7,000 more, paid as \$3,500 a month for two months\./,
	);
	assert.match(partnershipCopy, /Billed \$10,000 a quarter\./);
	assert.match(partnershipCopy, /offer: "Partnership \(Quarterly\)"/);
	assert.match(partnershipCopy, /exclude VAT where it applies/);
	assert.match(
		partnershipCopy,
		/We start with a kick-off call, and you give me a trial or sandbox account\./,
	);
	assert.match(
		partnershipCopy,
		/At the day-90 read-out, we go through what changed and decide what to work on next quarter\./,
	);
	assert.match(partnershipCopy, /title: "Partner round table"/);
	assert.match(partnershipCopy, /"Slack Connect with me",/);
	assert.doesNotMatch(partnershipCopy, /"Slack Connect with David"/);
	assert.match(partnershipCopy, /roadmap trade-offs\./);
	assert.match(
		partnershipCopy,
		/"A day-90 review compared with the original, and a read-out on what changed",/,
	);
	assert.match(partnershipCopy, /"A ranked list of what to fix first"/);
	assert.match(
		partnershipCopy,
		/You get a written list of what to fix first in 10 business days for \$5,000/,
	);
	assert.match(partnershipCopy, /export const productReviewScope =/);
	assert.match(partnershipCopy, /export const productReviewCompletion =/);
	assert.match(letsChat, /David reads every enquiry and replies by email\./);
	assert.match(letsChat, /David replies by email with a recommendation:/);

	// Section order.
	const heroCta = page.indexOf('data-cta-location="hero"');
	const partners = page.indexOf('id="who-ive-worked-with"');
	const pullQuote = page.indexOf('id="pull-quote"');
	const process = page.indexOf('id="how-it-works"');
	const fit = page.indexOf('id="fit"');
	const pricing = page.indexOf('id="pricing"');
	const control = page.indexOf('id="no-lock-in"');
	const quotes = page.indexOf('id="partner-quotes"');
	const questions = page.indexOf('id="questions"');
	const enquiry = page.indexOf('id="apply"');
	const pinned = page.indexOf('data-cta-location="pinned"');

	assert(heroCta > -1);
	assert(heroCta < partners);
	assert(partners < pullQuote);
	assert(pullQuote < process);
	assert(process < fit);
	assert(fit < pricing);
	assert(pricing < control);
	assert(control < quotes);
	assert(quotes < questions);
	assert(questions < enquiry);
	assert(enquiry < pinned);
});

test("partnership enquiry is short and tracks its conversion steps", () => {
	for (const field of ["name", "email", "company", "message"]) {
		assert.match(form, new RegExp(`name="${field}"`));
	}
	for (const removedField of [
		"targetDevelopers",
		"technicalBuyer",
		"proofAssets",
		"budgetQuarter",
	]) {
		assert.doesNotMatch(form, new RegExp(`name="${removedField}"`));
	}
	assert.match(form, /name="website"/);
	assert.match(form, /class="form-honeypot"/);
	assert.doesNotMatch(form, /api\.attio\.com/);
	assert.match(action, /https:\/\/api\.attio\.com\/v2/);
	assert.match(page, /capture\("cta_clicked"/);
	assert.match(page, /<details>/);
	assert.match(page, /<summary>/);
	assert.match(page, /summary \{/);
	assert.doesNotMatch(page, /Accordion/);
	assert.match(form, /capturePartnershipEvent\("enquiry_form_started"\)/);
	assert.match(form, /capturePartnershipEvent\("enquiry_form_submitted"\)/);
	assert.match(form, /action="\?_action=partnership\.applyForm"/);
	assert.match(form, /name="path"/);
	assert.doesNotMatch(form, /:disabled="!ready/);
	assert.match(partnershipCopy, /"First-run review": "Product review"/);
	assert.match(partnershipCopy, /"Fit & Proof Review": "Product review"/);
	assert.doesNotMatch(partnershipCopy, /"Product review": "First-run review"/);
	assert.match(partnershipCopy, /"Annual plan"/);
	assert.match(action, /applicationPathDeals/);
	assert.match(action, /accept: "form"/);
	assert.doesNotMatch(action, /matching_attribute/);
	assert.doesNotMatch(action, /"PUT"/);
	assert.match(page, /serverFieldErrors=/);
	assert.match(page, /submittedValues=/);
	assert.match(page, /isInputError/);
	assert.match(form, /aria-describedby/);
	assert.match(form, /maxlength="200"/);
	assert.match(form, /maxlength="1000"/);
	assert.match(form, /maxlength="5000"/);
});

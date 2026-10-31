import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname } from "node:path";
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
	assert.match(page, /Make your product the one engineers reach for\./);
	assert.match(
		page,
		/I work hands-on with your product to show engineers what it can do, find where they get stuck and help them be successful from dev to prod\./,
	);
	assert.match(page, /<dt>Ways to work<\/dt>/);
	assert.match(page, /<dt>Ongoing partnership<\/dt>/);
	assert.doesNotMatch(page, /invoic|on delivery/i);
	assert.doesNotMatch(
		partnershipCopy
			.match(/export const partnershipDescription =[^;]+;/g)
			?.join("\n") ?? "",
		/invoic|on delivery/i,
	);
	// Unverified catalogue totals must not be presented as audience proof.
	assert.doesNotMatch(partnershipCopy, /450 hours/);
	assert.match(partnershipCopy, /28\.2K YouTube subscribers/);
	assert.match(page, /<ReviewPreview placement="always" \/>/);
	assert.doesNotMatch(page, /<ReviewPreview slot="aside"/);
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
		/I record where I get stuck, rank what needs fixing or explaining/,
	);
	assert.match(page, /answer: productReviewScope/);
	assert.doesNotMatch(page, /Who is this a good fit for\?|How do we stop\?/);

	// Fit.
	assert.match(page, /Teams I work best with/);
	assert.match(
		page,
		/You build developer tools: infrastructure tools, Kubernetes and cloud native projects, cloud platforms or AI infrastructure\./,
	);
	assert.match(
		page,
		/An engineer can install or sign up for your product and try it, including open-source projects installed from GitHub or Helm\./,
	);
	assert.match(
		page,
		/Any size of company, from a first open-source release to a public company\./,
	);

	// The three areas are distinct, with a direct route to ongoing work.
	assert.match(page, /adoptionStages\.map/);
	for (const stage of ["awareness", "adoption", "support"]) {
		assert.match(partnershipCopy, new RegExp(`id: "${stage}"`));
		assert.match(partnershipCopy, new RegExp(`ctaLocation: "stage-${stage}"`));
	}
	assert.match(page, /data-cta-location=\{stage\.ctaLocation\}/);
	assert.match(page, />Awareness, Adoption, and Support<\/h2>/);
	assert.match(page, /Can we start an ongoing partnership straight away\?/);

	// Public coverage remains independent of the agreed delivery scope.
	assert.match(page, /independenceRules\.map/);
	for (const rule of [
		"We agree the scope",
		"My conclusions stay independent",
		"Paid work is labelled",
	]) {
		assert.match(partnershipCopy, new RegExp(`title: "${rule}"`));
	}

	// Partners: one alphabetical grid, current and past together.
	assert.match(page, /Teams I've worked with/);
	assert.doesNotMatch(page, /Who I've worked with/);
	assert.match(page, /<PartnerLogos \/>/);
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
	assert.match(page, /ongoingPartnershipOffer\.included\.map/);
	assert.doesNotMatch(page, /What's not included|Not a fit/);
	assert.match(page, /data-pinned-cta="Ask about an ongoing partnership"/);
	assert.deepEqual(
		Array.from(page.matchAll(/data-cta-location="([^"]+)"/g), (m) => m[1]),
		[
			"hero",
			"hero-watch",
			"pricing-brief",
			"pricing-ongoing",
			"pricing-addon",
			"events",
			"pricing-supporter",
			"pinned",
		],
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
	assert.match(page, /detail: partnershipOwnership/);
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
	assert.doesNotMatch(
		partnershipCopy,
		/What you pay for a first engagement counts towards an ongoing partnership/,
	);
	assert.match(partnershipCopy, /price: "\$10,000"/);
	assert.match(partnershipCopy, /price: "\$5,000"/);
	assert.match(partnershipCopy, /price: "Quoted to scope"/);
	assert.match(partnershipCopy, /price: "\$12,000 a quarter"/);
	assert.match(
		partnershipCopy,
		/or \$40,000 for a 12-month contract, billed \$10,000 a quarter\./,
	);
	assert.match(partnershipCopy, /exclude VAT where it applies/);
	assert.match(
		partnershipCopy,
		/Questions and feedback in Slack Connect, with response times agreed in the scope/,
	);
	assert.doesNotMatch(partnershipCopy, /"Slack Connect with David"/);
	assert.match(partnershipCopy, /"A ranked list of what to fix first"/);
	assert.match(
		partnershipCopy,
		/Hands-on content, adoption reviews, docs, community, talks and office hours/,
	);
	assert.match(partnershipCopy, /export const productReviewScope =/);
	assert.match(letsChat, /David reads every enquiry and replies by email\./);
	assert.match(letsChat, /David replies by email with a recommendation:/);

	// Section order.
	const heroCta = page.indexOf('data-cta-location="hero"');
	const partners = page.indexOf('id="who-ive-worked-with"');
	const pullQuote = page.indexOf('id="pull-quote"');
	const process = page.indexOf('id="stages"');
	const measurement = page.indexOf('id="measurement"');
	const fit = page.indexOf('id="fit"');
	const pricing = page.indexOf('id="pricing"');
	const events = page.indexOf('id="events"');
	const control = page.indexOf('id="no-lock-in"');
	const independence = page.indexOf('id="independence"');
	const quotes = page.indexOf('id="partner-quotes"');
	const questions = page.indexOf('id="questions"');
	const enquiry = page.indexOf('id="apply"');
	const pinned = page.indexOf('data-cta-location="pinned"');

	assert(heroCta > -1);
	assert(heroCta < partners);
	assert(partners < pullQuote);
	assert(pullQuote < process);
	assert(process < measurement);
	assert(measurement < quotes);
	assert(quotes < fit);
	assert(fit < pricing);
	assert(pricing < events);
	assert(events < control);
	assert(control < independence);
	assert(independence < questions);
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
	assert.match(action, /env\.PARTNERSHIP_EMAIL\.send/);
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
	assert.match(partnershipCopy, /"First-run review": "Adoption review"/);
	assert.match(partnershipCopy, /"Fit & Proof Review": "Adoption review"/);
	assert.doesNotMatch(partnershipCopy, /"Product review": "First-run review"/);
	assert.match(partnershipCopy, /"Annual plan": "Ongoing partnership"/);
	assert.match(partnershipCopy, /"90-day partnership": "Ongoing partnership"/);
	assert.match(action, /to: PARTNERSHIP_EMAIL/);
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

// Block the rejected offer name across website sources, including metadata,
// mailto subjects and public files, rather than only checking the visible card.
const disallowedOfferName = new RegExp(
	["field", "report"].join("(?:[\\s_-]|%20)*"),
	"i",
);
const websiteTextExtensions = new Set([
	".astro",
	".vue",
	".ts",
	".tsx",
	".js",
	".jsx",
	".mjs",
	".cjs",
	".json",
	".jsonld",
	".html",
	".md",
	".mdx",
	".txt",
	".xml",
	".svg",
	".csv",
	".yaml",
	".yml",
	".css",
	".toml",
]);
function* websiteSources(directory) {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		if (
			["tests", "__tests__", "node_modules", "dist", ".astro"].includes(
				entry.name,
			)
		)
			continue;
		const url = new URL(
			entry.name + (entry.isDirectory() ? "/" : ""),
			directory,
		);
		if (entry.isDirectory()) {
			yield* websiteSources(url);
		} else if (
			websiteTextExtensions.has(extname(entry.name)) &&
			!/[.](test|spec)[.]/.test(entry.name)
		) {
			yield url;
		}
	}
}

test("website production sources exclude the rejected offer name", () => {
	for (const directory of [
		new URL("../", import.meta.url),
		new URL("../../public/", import.meta.url),
	]) {
		for (const source of websiteSources(directory)) {
			assert.doesNotMatch(
				readFileSync(source, "utf8"),
				disallowedOfferName,
				source.pathname,
			);
		}
	}
});

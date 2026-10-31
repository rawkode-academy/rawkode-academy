import { readFileSync } from "node:fs";
import { DOMRect, type HTMLElement, Window } from "happy-dom";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	bespokeProjectOffer,
	supportAcademyOffer,
	ongoingPartnershipOffer,
	partnershipAddOns,
} from "@/lib/partnerships";

const offers = [
	{
		...supportAcademyOffer,
		route: "Support the Academy",
		cta: "Support the Academy",
		ctaName: "support_the_academy",
	},
	{
		...ongoingPartnershipOffer,
		route: "Partnership",
		cta: "Ask about a partnership",
		ctaName: "ask_about_a_partnership",
	},
	{
		...bespokeProjectOffer,
		route: "Bespoke project",
		cta: "Discuss a project",
		ctaName: "discuss_a_project",
	},
	{
		name: partnershipAddOns[0].title,
		price: partnershipAddOns[0].price,
		route: "Community challenge series",
		cta: "Ask about a challenge series",
		ctaName: "ask_about_a_challenge_series",
	},
];

// Exercise the page's actual browser script with layout supplied by the test.
const page = readFileSync(
	"src/pages/organizations/partnerships/index.astro",
	"utf8",
);
const scriptStart = page.indexOf("<script>");
const scriptEnd = page.indexOf("</script>", scriptStart);
if (scriptStart === -1 || scriptEnd === -1) {
	throw new Error("Partnership page script is missing");
}
const script = page.slice(scriptStart + "<script>".length, scriptEnd);
const { outputText } = ts.transpileModule(script, {
	compilerOptions: { target: ts.ScriptTarget.ES2022 },
});

let browser: Window;
let capture: ReturnType<typeof vi.fn>;
let scheduled: FrameRequestCallback | undefined;
let heroBottom: number;
let enquiryTop: number;
let positions: Array<{ top: number; height: number }>;

const rect = (top: number, height: number) => new DOMRect(0, top, 340, height);
const pinned = () =>
	browser.document.querySelector("[data-partnership-pinned]") as HTMLElement;
const link = () => pinned().querySelector("a")!;
const scroll = () => {
	browser.dispatchEvent(new browser.Event("scroll"));
	const next = scheduled;
	scheduled = undefined;
	next?.(0);
};

beforeEach(() => {
	browser = new Window({
		url: "https://academy.test/organizations/partnerships",
	});
	browser.innerHeight = 600;
	capture = vi.fn();
	heroBottom = -20;
	enquiryTop = 5000;
	positions = offers.map(() => ({ top: 2000, height: 1600 }));
	browser.document.body.innerHTML = `
		<a id="partnership-hero-cta">Enquire</a>
		${offers
			.map(
				(offer) => `<article
			data-pinned-name="${offer.name}" data-pinned-price="${offer.price}"
			data-pinned-route="${offer.route}" data-pinned-href="?route=${encodeURIComponent(offer.route)}#enquiry-form"
			data-pinned-cta="${offer.cta}" data-pinned-cta-name="${offer.ctaName}"></article>`,
			)
			.join("")}
		<section id="apply"></section>
		<div data-partnership-pinned><p><strong>Support the Academy</strong><span>${supportAcademyOffer.price}</span></p>
			<a href="?route=Support%20the%20Academy#enquiry-form" data-apply-path="Support the Academy"
				data-partnership-cta data-cta="support_the_academy" data-cta-location="pinned"
				tabindex="-1">Support the Academy</a>
		</div>`;
	browser.document.getElementById(
		"partnership-hero-cta",
	)!.getBoundingClientRect = () => rect(heroBottom - 40, 40);
	browser.document.getElementById("apply")!.getBoundingClientRect = () =>
		rect(enquiryTop, 600);
	pinned().getBoundingClientRect = () => rect(520, 80);
	browser.document.querySelectorAll("article").forEach((plan, index) => {
		plan.getBoundingClientRect = () =>
			rect(positions[index]!.top, positions[index]!.height);
	});
	browser.requestAnimationFrame = (callback) => {
		scheduled = callback;
		return setImmediate(() => {});
	};
	Object.assign(browser, { posthog: { capture } });
	new Function("document", "window", outputText)(browser.document, browser);
});

afterEach(async () => {
	await browser.happyDOM.abort();
	browser.close();
});

describe("partnership pinned enquiry", () => {
	it("follows a card taller than two mobile screens and tracks its own offer", () => {
		positions[0] = { top: -400, height: 1600 };
		scroll();
		expect(pinned().hasAttribute("data-visible")).toBe(true);
		expect(link().textContent).toBe("Support the Academy");
		expect(link().dataset.applyPath).toBe("Support the Academy");
		expect(link().href).toContain("route=Support%20the%20Academy#enquiry-form");
		link().addEventListener("click", (event) => event.preventDefault());
		link().click();
		expect(capture).toHaveBeenCalledWith(
			"cta_clicked",
			expect.objectContaining({
				cta: "support_the_academy",
				location: "pinned",
			}),
		);
	});

	it("chooses the most visible card after an anchor jump in either direction", () => {
		positions[0] = { top: -1500, height: 1600 };
		positions[3] = { top: 100, height: 900 };
		scroll();
		expect(link().dataset.applyPath).toBe("Community challenge series");
		positions[0] = { top: -400, height: 1600 };
		positions[3] = { top: 1200, height: 900 };
		scroll();
		expect(link().dataset.applyPath).toBe("Support the Academy");
	});

	it("returns to community support between scoped extras", () => {
		positions[1] = { top: 0, height: 1000 };
		scroll();
		positions[1] = { top: -1200, height: 1000 };
		scroll();
		expect(link().textContent).toBe("Support the Academy");
		expect(link().dataset.applyPath).toBe("Support the Academy");
		expect(link().dataset.cta).toBe("support_the_academy");
		expect(pinned().querySelector("strong")!.textContent).toBe(
			"Support the Academy",
		);
	});

	it("keeps the hidden bar out of the tab order at the hero and enquiry form", () => {
		expect(link().tabIndex).toBe(0);
		heroBottom = 100;
		scroll();
		expect(pinned().hasAttribute("data-visible")).toBe(false);
		expect(link().tabIndex).toBe(-1);
		heroBottom = -20;
		enquiryTop = 400;
		scroll();
		expect(pinned().hasAttribute("data-visible")).toBe(false);
		expect(link().tabIndex).toBe(-1);
	});
});

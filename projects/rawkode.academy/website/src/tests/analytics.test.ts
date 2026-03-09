import { describe, expect, it } from "vitest";
import { GROWTH_EVENTS } from "@/lib/analytics/growth";
import { getAttributionFromSource } from "@/server/analytics";

describe("server analytics helpers", () => {
	it("extracts newsletter page attribution from source strings", () => {
		expect(
			getAttributionFromSource("website:newsletter:/watch/kubernetes"),
		).toEqual({
			source: "website:newsletter:/watch/kubernetes",
			source_system: "website",
			source_surface: "newsletter",
			page_path: "/watch/kubernetes",
		});
	});

	it("extracts lead magnet context and page attribution", () => {
		expect(
			getAttributionFromSource(
				"website:lead-magnet:k8s-1-35:/resources/kubernetes/1.35-cheatsheet",
			),
		).toEqual({
			source:
				"website:lead-magnet:k8s-1-35:/resources/kubernetes/1.35-cheatsheet",
			source_system: "website",
			source_surface: "lead-magnet",
			source_context: "k8s-1-35",
			page_path: "/resources/kubernetes/1.35-cheatsheet",
		});
	});

	it("extracts course signup context and landing page attribution", () => {
		expect(
			getAttributionFromSource(
				"website:course-signup:complete-guide-zitadel:/courses/complete-guide-zitadel",
			),
		).toEqual({
			source:
				"website:course-signup:complete-guide-zitadel:/courses/complete-guide-zitadel",
			source_system: "website",
			source_surface: "course-signup",
			source_context: "complete-guide-zitadel",
			page_path: "/courses/complete-guide-zitadel",
		});
	});

	it("exposes canonical growth event names for newsletter, lead magnets, and activation", () => {
		expect(GROWTH_EVENTS.ACTIVATED_USER).toBe("activated_user");
		expect(GROWTH_EVENTS.NEWSLETTER_CTA_IMPRESSION).toBe(
			"newsletter_cta_impression",
		);
		expect(GROWTH_EVENTS.NEWSLETTER_SUBMISSION_ATTEMPTED).toBe(
			"newsletter_submission_attempted",
		);
		expect(GROWTH_EVENTS.NEWSLETTER_SUBSCRIBED).toBe("newsletter_subscribed");
		expect(GROWTH_EVENTS.LEAD_MAGNET_CLICKED).toBe("lead_magnet_clicked");
		expect(GROWTH_EVENTS.LEAD_MAGNET_SUBMISSION_ATTEMPTED).toBe(
			"lead_magnet_submission_attempted",
		);
		expect(GROWTH_EVENTS.LEAD_MAGNET_SIGNUP).toBe("lead_magnet_signup");
	});
});

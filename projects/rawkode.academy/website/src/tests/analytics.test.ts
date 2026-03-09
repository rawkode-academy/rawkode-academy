import { describe, expect, it } from "vitest";
import {
	getAttributionFromSource,
	GROWTH_EVENTS,
} from "@/server/analytics";

describe("server analytics helpers", () => {
	it("extracts newsletter page attribution from source strings", () => {
		expect(getAttributionFromSource("website:newsletter:/watch/kubernetes")).toEqual({
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
			source: "website:lead-magnet:k8s-1-35:/resources/kubernetes/1.35-cheatsheet",
			source_system: "website",
			source_surface: "lead-magnet",
			source_context: "k8s-1-35",
			page_path: "/resources/kubernetes/1.35-cheatsheet",
		});
	});

	it("exposes canonical newsletter growth event names", () => {
		expect(GROWTH_EVENTS.NEWSLETTER_SUBSCRIBED).toBe("newsletter_subscribed");
		expect(GROWTH_EVENTS.NEWSLETTER_UNSUBSCRIBED).toBe(
			"newsletter_unsubscribed",
		);
	});
});

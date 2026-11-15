import { describe, expect, it } from "vitest";
import { episodePageTitle, SEO_TITLE_LIMIT } from "./episode-title";

describe("episodePageTitle", () => {
	it("adds the show to an episode title", () => {
		expect(episodePageTitle("22. Borko Vs. Bojan", "Klustered")).toBe(
			"22. Borko Vs. Bojan | Klustered",
		);
	});

	it("leaves a title with no show alone", () => {
		expect(episodePageTitle("Hands-On with Kairos")).toBe(
			"Hands-On with Kairos",
		);
	});

	it("does not repeat a show the title already names", () => {
		expect(episodePageTitle("Klustered #10", "Klustered")).toBe(
			"Klustered #10",
		);
	});

	it("replaces a stored show suffix instead of doubling it", () => {
		expect(
			episodePageTitle("22. Borko Vs. Bojan | klustered", "Klustered"),
		).toBe("22. Borko Vs. Bojan | Klustered");
	});

	it("keeps a pipe that is not the show", () => {
		expect(episodePageTitle("Palette | No-Code", "Rawkode Live")).toBe(
			"Palette | No-Code | Rawkode Live",
		);
	});

	it("drops the show when it would pass the search-result limit", () => {
		const title = "x".repeat(SEO_TITLE_LIMIT - 5);
		expect(episodePageTitle(title, "Klustered")).toBe(title);
	});
});

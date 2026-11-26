import { describe, expect, it } from "vitest";
import { partnerLink } from "@/utils/partner-link";

describe("partnerLink", () => {
	it("adds the Academy's UTM parameters", () => {
		expect(partnerLink("https://goteleport.com", { medium: "collaboration-credit", campaign: "22-borko-vs-bojan" })).toBe(
			"https://goteleport.com/?utm_source=rawkode.academy&utm_medium=collaboration-credit&utm_campaign=22-borko-vs-bojan",
		);
	});

	it("keeps the path, query and fragment, and adds the content when given", () => {
		expect(
			partnerLink("https://example.com/docs?ref=a#start", { medium: "collaboration-credit", campaign: "course", content: "lesson" }),
		).toBe("https://example.com/docs?ref=a&utm_source=rawkode.academy&utm_medium=collaboration-credit&utm_campaign=course&utm_content=lesson#start");
	});

	it("does not overwrite a UTM parameter the partner set", () => {
		const url = new URL(partnerLink("https://example.com/?utm_campaign=launch", { medium: "supporter", campaign: "supporters" }));
		expect(url.searchParams.get("utm_campaign")).toBe("launch");
		expect(url.searchParams.get("utm_source")).toBe("rawkode.academy");
	});

	it("returns anything that is not an http(s) URL unchanged", () => {
		expect(partnerLink("not a url", { medium: "supporter", campaign: "home" })).toBe("not a url");
		expect(partnerLink("mailto:hi@example.com", { medium: "supporter", campaign: "home" })).toBe("mailto:hi@example.com");
	});
});

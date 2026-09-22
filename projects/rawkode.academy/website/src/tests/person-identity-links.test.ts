import { describe, expect, it } from "vitest";
import { getPersonIdentityUrls } from "../lib/person-identity-links";

describe("person identity URLs", () => {
	it("uses only dedicated transformed social-profile fields", () => {
		const person = {
			github: "https://github.com/person", twitter: "https://x.com/person",
			bluesky: "https://bsky.app/profile/person.test", linkedin: "https://www.linkedin.com/in/person",
			mastodon: "https://social.test/@person", website: "https://company.test/", youtube: "https://youtube.test/company",
		};
		expect(getPersonIdentityUrls(person)).toEqual([person.github, person.twitter, person.bluesky, person.linkedin, person.mastodon]);
	});
	it("omits absent/empty fields without inventing identity URLs", () => {
		expect(getPersonIdentityUrls({})).toEqual([]);
		expect(getPersonIdentityUrls({ github: undefined, twitter: "" })).toEqual([]);
	});
	it("does not infer an identity from a website or channel alone", () => {
		const person = { github: undefined, website: "https://rawkode.academy/watch/episode", youtube: "https://youtube.com/@RawkodeAcademy" };
		expect(getPersonIdentityUrls(person)).toEqual([]);
	});
	it("deduplicates only exact URLs, preserves fragments and never mutates input", () => {
		const person = Object.freeze({ github: "https://example.test/#profile", twitter: "https://example.test/#profile", mastodon: "https://example.test/#other" });
		expect(getPersonIdentityUrls(person)).toEqual([person.github, person.mastodon]);
		expect(person.twitter).toBe(person.github);
	});
});

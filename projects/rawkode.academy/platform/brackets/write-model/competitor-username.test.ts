import { describe, expect, it } from "bun:test";
import { planCompetitorUsernameSync } from "./competitor-username";

describe("planCompetitorUsernameSync", () => {
	it("uses the exact GitHub username for linked competitor rows", () => {
		expect(
			planCompetitorUsernameSync({
				competitors: [
					{ id: "winter", seasonId: "winter", personSlug: "david-flanagan" },
					{ id: "spring", seasonId: "spring", personSlug: "rawkode" },
				],
				username: "rawkode",
				usernameOwners: [
					{ id: "spring", seasonId: "spring", personSlug: "rawkode" },
				],
			}),
		).toEqual([
			{ id: "winter", seasonId: "winter", personSlug: "rawkode" },
		]);
	});

	it("refuses a username already assigned to another competitor in the same season", () => {
		expect(() =>
			planCompetitorUsernameSync({
				competitors: [
					{ id: "linked", seasonId: "winter", personSlug: "old-name" },
				],
				username: "rawkode",
				usernameOwners: [
					{ id: "other", seasonId: "winter", personSlug: "rawkode" },
				],
			}),
		).toThrow("already assigned");
	});

	it("allows the same username in a different season", () => {
		expect(
			planCompetitorUsernameSync({
				competitors: [
					{ id: "linked", seasonId: "winter", personSlug: "old-name" },
				],
				username: "rawkode",
				usernameOwners: [
					{ id: "other", seasonId: "summer", personSlug: "rawkode" },
				],
			}),
		).toEqual([
			{ id: "linked", seasonId: "winter", personSlug: "rawkode" },
		]);
	});
});

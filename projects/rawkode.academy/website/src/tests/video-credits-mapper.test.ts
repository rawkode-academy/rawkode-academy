import { describe, expect, it } from "vitest";
import { mapVideo } from "@/lib/live-content/mappers";

const base = { id: "v1", title: "T", slug: "t", publishedAt: "2026-01-02T00:00:00.000Z" };

describe("mapVideo casting credits", () => {
	it("maps credited people with lower-cased roles", () => {
		const video = mapVideo({
			...base,
			castingCredits: [
				{ role: "HOST", person: { id: "rawkode" } },
				{ role: "CO_HOST", person: { id: "nimbinatus" } },
				{ role: "GUEST", person: { id: "ada" } },
				{ role: "BOGUS", person: { id: "x" } },
			],
		});
		expect(video.credits?.map((c) => [c.role, c.person.id])).toEqual([
			["host", "rawkode"],
			["co_host", "nimbinatus"],
			["guest", "ada"],
		]);
	});

	it("is empty when the video has no credits", () => {
		expect(mapVideo({ ...base }).credits).toEqual([]);
	});
});

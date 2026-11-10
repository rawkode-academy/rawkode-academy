import { describe, expect, it } from "vitest";
import {
	formatRuntime,
	formatRuntimeLabel,
	isUpcomingLiveVideo,
} from "@/lib/video-runtime";

const now = new Date("2026-06-06T12:00:00.000Z");

describe("video runtime labels", () => {
	it("labels future live videos as upcoming", () => {
		const video = {
			duration: 3600,
			publishedAt: "2026-07-09T17:00:00.000Z",
			type: "live",
		};

		expect(isUpcomingLiveVideo(video, now)).toBe(true);
		expect(formatRuntimeLabel(video, now)).toBe("Upcoming");
	});

	it("keeps recorded and past live videos on duration labels", () => {
		expect(
			formatRuntimeLabel(
				{
					duration: 3600,
					publishedAt: "2026-07-09T17:00:00.000Z",
					type: "recorded",
				},
				now,
			),
		).toBe("1h");
		expect(
			formatRuntimeLabel(
				{
					duration: 3600,
					publishedAt: "2026-06-01T17:00:00.000Z",
					type: "live",
				},
				now,
			),
		).toBe("1h");
	});

	it("sets a card runtime in one form and omits an unknown one", () => {
		expect(formatRuntime(3722)).toBe("1h 2m");
		expect(formatRuntime(7200)).toBe("2h");
		expect(formatRuntime(2700)).toBe("45 min");
		expect(formatRuntime(20)).toBe("<1 min");
		for (const unknown of [undefined, null, 0, -1, Number.NaN, Infinity])
			expect(formatRuntime(unknown)).toBeUndefined();
		expect(
			formatRuntimeLabel(
				{ duration: 0, publishedAt: "2026-07-09T17:00:00.000Z", type: "live" },
				now,
			),
		).toBe("Upcoming");
	});
});

import { describe, expect, it } from "vitest";
import {
	formatVideoRuntime,
	formatVideoRuntimeLabel,
	isUpcomingLiveVideo,
} from "@/lib/video-runtime";

const now = new Date("2026-06-06T12:00:00.000Z");

describe("video runtime labels", () => {
	it("formats standard runtimes", () => {
		expect(formatVideoRuntime(3600)).toBe("1:00:00");
		expect(formatVideoRuntime(95)).toBe("1:35");
		expect(formatVideoRuntime(undefined)).toBe("--:--");
	});

	it("labels future live videos as upcoming", () => {
		const video = {
			duration: 3600,
			publishedAt: "2026-07-09T17:00:00.000Z",
			type: "live",
		};

		expect(isUpcomingLiveVideo(video, now)).toBe(true);
		expect(formatVideoRuntimeLabel(video, now)).toBe("Upcoming");
	});

	it("keeps recorded and past live videos on duration labels", () => {
		expect(
			formatVideoRuntimeLabel(
				{
					duration: 3600,
					publishedAt: "2026-07-09T17:00:00.000Z",
					type: "recorded",
				},
				now,
			),
		).toBe("1:00:00");
		expect(
			formatVideoRuntimeLabel(
				{
					duration: 3600,
					publishedAt: "2026-06-01T17:00:00.000Z",
					type: "live",
				},
				now,
			),
		).toBe("1:00:00");
	});
});

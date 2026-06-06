import { describe, expect, it } from "vitest";
import { formatStreamingCountdown } from "@/lib/streaming-countdown";

describe("formatStreamingCountdown", () => {
	const now = new Date("2026-06-06T12:00:00.000Z");

	it("formats days and hours for distant streams", () => {
		expect(formatStreamingCountdown("2026-06-09T15:00:00.000Z", now)).toBe(
			"Streaming in 3 days, 3 hours",
		);
	});

	it("formats hours and minutes for same-day streams", () => {
		expect(formatStreamingCountdown("2026-06-06T14:30:00.000Z", now)).toBe(
			"Streaming in 2 hours, 30 minutes",
		);
	});

	it("formats minutes for imminent streams", () => {
		expect(formatStreamingCountdown("2026-06-06T12:10:00.000Z", now)).toBe(
			"Streaming in 10 minutes",
		);
	});

	it("falls back once the stream time has arrived", () => {
		expect(formatStreamingCountdown("2026-06-06T12:00:00.000Z", now)).toBe(
			"Streaming soon",
		);
	});
});

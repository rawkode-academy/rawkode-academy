import { describe, expect, it } from "vitest";
import {
	buildStreamNotification,
	isUpcomingLiveVideo,
	streamNotificationDedupeKey,
	streamNotificationSubjectKey,
} from "@/lib/stream-notifications";

describe("stream notifications", () => {
	it("builds a generic notification intent for an upcoming stream", () => {
		const notification = buildStreamNotification({
			slug: "hands-on-introduction-to-iroh",
			id: "7f1dfedcbf38a19375306862",
			title: "Hands-on Introduction to Iroh",
			origin: "https://rawkode.academy",
		});

		expect(notification).toMatchObject({
			dedupeKey: "stream:hands-on-introduction-to-iroh:live-start",
			kind: "stream-started",
			subjectKey: "stream:hands-on-introduction-to-iroh",
			title: "Hands-on Introduction to Iroh is live",
			body: "The stream has started on Rawkode Academy.",
			url: "https://rawkode.academy/watch/hands-on-introduction-to-iroh",
			tag: "stream:hands-on-introduction-to-iroh",
			data: {
				videoSlug: "hands-on-introduction-to-iroh",
				videoId: "7f1dfedcbf38a19375306862",
			},
		});
	});

	it("identifies only future live videos as notifiable", () => {
		const now = new Date("2026-06-06T12:00:00.000Z");

		expect(
			isUpcomingLiveVideo(
				{ type: "live", publishedAt: new Date("2026-07-09T17:00:00.000Z") },
				now,
			),
		).toBe(true);
		expect(
			isUpcomingLiveVideo(
				{ type: "live", publishedAt: new Date("2026-05-09T17:00:00.000Z") },
				now,
			),
		).toBe(false);
		expect(
			isUpcomingLiveVideo(
				{ type: "tutorial", publishedAt: new Date("2026-07-09T17:00:00.000Z") },
				now,
			),
		).toBe(false);
	});

	it("uses stable per-stream send keys", () => {
		expect(streamNotificationDedupeKey("hands-on-introduction-to-iroh")).toBe(
			"stream:hands-on-introduction-to-iroh:live-start",
		);
		expect(streamNotificationSubjectKey("hands-on-introduction-to-iroh")).toBe(
			"stream:hands-on-introduction-to-iroh",
		);
	});
});

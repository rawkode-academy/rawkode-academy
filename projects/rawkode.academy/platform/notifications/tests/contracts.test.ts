import { describe, expect, it } from "vitest";
import {
	assertPushSubscriptionInput,
	assertRegisterNotificationInput,
	assertSendSubjectInput,
	createNotificationPayload,
} from "../src/contracts.js";

const p256dh =
	"BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const auth = "AQEBAQEBAQEBAQEBAQEBAQ";

describe("notification contracts", () => {
	it("accepts a valid push subscription", () => {
		expect(() =>
			assertPushSubscriptionInput({
				endpoint: "https://push.example.test/send/123",
				keys: {
					p256dh,
					auth,
				},
			}),
		).not.toThrow();
	});

	it("rejects malformed push subscription keys", () => {
		expect(() =>
			assertPushSubscriptionInput({
				endpoint: "https://push.example.test/send/123",
				keys: {
					p256dh: "public-key",
					auth,
				},
			}),
		).toThrow("subscription.keys.p256dh must be an uncompressed P-256 public key");
	});

	it("rejects non-HTTPS push endpoints", () => {
		expect(() =>
			assertPushSubscriptionInput({
				endpoint: "http://push.example.test/send/123",
				keys: {
					p256dh,
					auth,
				},
			}),
		).toThrow("subscription.endpoint must use https");
	});

	it("rejects notification intents without a subject", () => {
		expect(() =>
			assertRegisterNotificationInput({
				subscription: {
					endpoint: "https://push.example.test/send/123",
					keys: { p256dh, auth },
				},
				notification: {
					dedupeKey: "stream:hands-on-introduction-to-iroh:live-start",
					kind: "stream-started",
					subjectKey: "",
					title: "Hands-on Introduction to Iroh is live",
					body: "The stream has started on Rawkode Academy.",
					url: "https://rawkode.academy/watch/hands-on-introduction-to-iroh",
					tag: "stream:hands-on-introduction-to-iroh",
				},
			}),
		).toThrow("notification.subjectKey is required");
	});

	it("builds a browser notification payload from stored data", () => {
		const payload = createNotificationPayload({
			title: "Hands-on Introduction to Iroh is live",
			body: "The stream has started on Rawkode Academy.",
			tag: "stream:hands-on-introduction-to-iroh",
			url: "https://rawkode.academy/watch/hands-on-introduction-to-iroh",
			kind: "stream-started",
			dataJson: JSON.stringify({
				videoSlug: "hands-on-introduction-to-iroh",
			}),
		});

		expect(payload).toMatchObject({
			title: "Hands-on Introduction to Iroh is live",
			tag: "stream:hands-on-introduction-to-iroh",
			url: "https://rawkode.academy/watch/hands-on-introduction-to-iroh",
			kind: "stream-started",
			data: {
				videoSlug: "hands-on-introduction-to-iroh",
			},
		});
	});

	it("accepts subject sends with live-start overrides", () => {
		expect(() =>
			assertSendSubjectInput({
				subjectKey: "stream:hands-on-introduction-to-iroh",
				body: "Rawkode Academy is live now.",
				data: {
					realtimeKitEvent: "livestreaming.statusUpdate",
				},
			}),
		).not.toThrow();
	});
});

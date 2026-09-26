import { describe, expect, test } from "vitest";
import {
	acceptsDeliverySequence,
	acceptsRoomVersion,
} from "../src/lib/version-guard";

describe("live socket version guard", () => {
	test("rejects a stale snapshot or event after a newer authoritative frame", () => {
		expect(acceptsRoomVersion(8, 7)).toBe(false);
		expect(acceptsRoomVersion(8, 8)).toBe(true);
		expect(acceptsRoomVersion(8, 9)).toBe(true);
	});

	test("rejects a reversed snapshot with the same gameplay version", () => {
		// Audience telemetry can retain the gameplay version, so only the
		// strictly increasing durable delivery sequence is safe for snapshots.
		expect(acceptsDeliverySequence(41, 42)).toBe(true);
		expect(acceptsDeliverySequence(42, 42)).toBe(false);
		expect(acceptsDeliverySequence(42, 41)).toBe(false);
	});
});

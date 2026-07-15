import { describe, expect, it } from "vitest";
import { getWebRtcConnectionHealth } from "./connectionHealth";

describe("getWebRtcConnectionHealth", () => {
	it.each([
		["new", "connecting"],
		["connecting", "connecting"],
		["connected", "healthy"],
		["disconnected", "degraded"],
		["failed", "failed"],
		["closed", "failed"],
	] as const)("maps %s to %s", (connectionState, expected) => {
		expect(getWebRtcConnectionHealth(connectionState)).toBe(expected);
	});
});

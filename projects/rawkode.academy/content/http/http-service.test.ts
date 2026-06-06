import { describe, expect, it } from "vitest";
import { isPublicContentKey } from "./public-key-policy";

describe("content public key policy", () => {
	it("keeps VOD outputs public", () => {
		expect(isPublicContentKey("videos/video-123/stream.m3u8")).toBe(true);
		expect(isPublicContentKey("videos/video-123/original.mp3")).toBe(true);
		expect(isPublicContentKey("videos/video-123/transcode-status.json")).toBe(true);
	});

	it("does not expose Studio recording source objects or ready markers", () => {
		expect(
			isPublicContentKey("studio/recordings/session-1/recording-1/source.webm"),
		).toBe(false);
		expect(
			isPublicContentKey("studio/recordings/session-1/recording-1/ready.json"),
		).toBe(false);
		expect(
			isPublicContentKey("studio/recordings/session-1/recording-1/transcode-status.json"),
		).toBe(false);
	});
});

import { describe, expect, it } from "vitest";
import { resolveWebRtcSessionResourceUrl } from "./webrtcSession";

describe("resolveWebRtcSessionResourceUrl", () => {
	it("resolves a relative WebRTC session location against the private endpoint", () => {
		const response = {
			headers: new Headers({ Location: "sessions/playback-123" }),
		};

		expect(
			resolveWebRtcSessionResourceUrl(
				"https://example.cloudflarestream.com/whep/input-123",
				response,
			),
		).toBe("https://example.cloudflarestream.com/whep/sessions/playback-123");
	});

	it("retains an absolute WebRTC session location", () => {
		const response = {
			headers: new Headers({
				Location: "https://sessions.cloudflarestream.com/playback-123",
			}),
		};

		expect(
			resolveWebRtcSessionResourceUrl(
				"https://example.cloudflarestream.com/whep/input-123",
				response,
			),
		).toBe("https://sessions.cloudflarestream.com/playback-123");
	});

	it("returns null when the server does not allocate a session resource", () => {
		expect(
			resolveWebRtcSessionResourceUrl(
				"https://example.cloudflarestream.com/whep/input-123",
				{ headers: new Headers() },
			),
		).toBeNull();
	});
});

import { describe, expect, it, vi } from "vitest";
import { createLiveEvent } from "./event-factory";
import { CloudflareStreamClient } from "./cloudflare-stream";

function jsonResponse(result: unknown) {
	return new Response(JSON.stringify({ success: true, result }), {
		headers: { "Content-Type": "application/json" },
	});
}

describe("CloudflareStreamClient", () => {
	it("creates live inputs with automatic recording and low latency enabled", async () => {
		const fetcher = vi.fn(async () => jsonResponse({
			uid: "input-1",
			rtmps: { url: "rtmps://live.cloudflare.com:443/live", streamKey: "key" },
			webRTC: { url: "https://customer.cloudflarestream.com/whip/input-1" },
		}));
		const client = new CloudflareStreamClient({
			accountId: "account-1",
			apiToken: "token-1",
			fetch: fetcher as typeof fetch,
		});

		const event = createLiveEvent({ title: "Rawkode Live" }, new Date("2026-06-04T12:00:00.000Z"));
		const input = await client.createLiveInput(event);

		expect(input.uid).toBe("input-1");
		expect(fetcher).toHaveBeenCalledTimes(1);
		const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/account-1/stream/live_inputs");
		expect(init.method).toBe("POST");
		const headers = new Headers(init.headers);
		expect(headers.get("Authorization")).toBe("Bearer token-1");
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(JSON.parse(init.body as string)).toMatchObject({
			meta: {
				name: "Rawkode Live",
				eventId: event.id,
				showId: "rawkode-live",
			},
			recording: {
				mode: "automatic",
				requireSignedURLs: false,
				timeoutSeconds: 10,
			},
			preferLowLatency: true,
		});
	});

	it("creates and updates simulcast outputs for live inputs", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ uid: "output-1", enabled: true }))
			.mockResolvedValueOnce(jsonResponse({ uid: "output-1", enabled: false }));
		const client = new CloudflareStreamClient({
			accountId: "account-1",
			apiToken: "token-1",
			fetch: fetcher as typeof fetch,
		});

		await client.createOutput("input-1", {
			platform: "youtube",
			label: "YouTube",
			outputUid: null,
			rtmpUrl: "rtmp://a.rtmp.youtube.com/live2",
			secretRef: "YOUTUBE_STREAM_KEY",
			enabled: true,
			health: "ready",
			lastError: null,
		}, "stream-key");
		await client.updateOutput("input-1", "output-1", false);

		const [createUrl, createInit] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
		expect(createUrl).toBe("https://api.cloudflare.com/client/v4/accounts/account-1/stream/live_inputs/input-1/outputs");
		expect(createInit.method).toBe("POST");
		expect(JSON.parse(createInit.body as string)).toEqual({
			url: "rtmp://a.rtmp.youtube.com/live2",
			streamKey: "stream-key",
			enabled: true,
		});

		const [updateUrl, updateInit] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
		expect(updateUrl).toBe("https://api.cloudflare.com/client/v4/accounts/account-1/stream/live_inputs/input-1/outputs/output-1");
		expect(updateInit.method).toBe("PUT");
		expect(JSON.parse(updateInit.body as string)).toEqual({ enabled: false });
	});
});

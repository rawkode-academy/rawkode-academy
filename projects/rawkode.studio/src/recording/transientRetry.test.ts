import { describe, expect, it, vi } from "vitest";
import {
	fetchWithTransientRetry,
	isTransientResponse,
} from "./transientRetry";

describe("recording upload transient retries", () => {
	it("retries bounded transient responses and honors Retry-After", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(
				new Response("slow down", {
					headers: { "Retry-After": "2" },
					status: 429,
				}),
			)
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		const sleep = vi.fn(async () => undefined);

		const response = await fetchWithTransientRetry(
			"/api/studio/recording-upload",
			{ method: "PUT" },
			{ baseDelayMs: 250, fetcher, maxAttempts: 3, sleep },
		);

		expect(response.status).toBe(200);
		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenNthCalledWith(1, 250);
		expect(sleep).toHaveBeenNthCalledWith(2, 2_000);
	});

	it("returns permanent errors without retrying", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockResolvedValue(new Response("invalid", { status: 400 }));
		const sleep = vi.fn(async () => undefined);

		const response = await fetchWithTransientRetry(
			"/api/studio/recording-upload",
			{ method: "PUT" },
			{ fetcher, sleep },
		);

		expect(response.status).toBe(400);
		expect(fetcher).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it("retries a network failure but not an aborted request", async () => {
		const fetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new TypeError("network unavailable"))
			.mockResolvedValueOnce(new Response("ok", { status: 200 }));
		const sleep = vi.fn(async () => undefined);

		await expect(
			fetchWithTransientRetry(
				"/api/studio/recording-upload",
				{ method: "PUT" },
				{ fetcher, sleep },
			),
		).resolves.toMatchObject({ status: 200 });
		expect(fetcher).toHaveBeenCalledTimes(2);

		const controller = new AbortController();
		controller.abort();
		const abortedFetcher = vi
			.fn<typeof fetch>()
			.mockRejectedValue(new DOMException("aborted", "AbortError"));
		await expect(
			fetchWithTransientRetry(
				"/api/studio/recording-upload",
				{ method: "PUT", signal: controller.signal },
				{ fetcher: abortedFetcher, sleep },
			),
		).rejects.toThrow("aborted");
		expect(abortedFetcher).toHaveBeenCalledTimes(1);
	});

	it("classifies only repeatable transient HTTP failures", () => {
		expect(isTransientResponse({ status: 408 })).toBe(true);
		expect(isTransientResponse({ status: 425 })).toBe(true);
		expect(isTransientResponse({ status: 429 })).toBe(true);
		expect(isTransientResponse({ status: 502 })).toBe(true);
		expect(isTransientResponse({ status: 409 })).toBe(false);
	});
});

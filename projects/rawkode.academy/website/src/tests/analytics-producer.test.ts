import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliverAnalyticsEvent } from "@/server/analytics-delivery";
import { captureServerEvent, identifyServerUser } from "@/server/analytics";
const event = {
	source: "website",
	id: "event-one",
	data: { private: "never-log-this" },
};
function acknowledged(disposition = "persisted", id = event.id) {
	return Response.json({
		success: true,
		receipt: {
			version: 1,
			event_source: event.source,
			event_id: id,
			disposition,
		},
	});
}
beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("producer acceptance", () => {
	it("retries a failed destination with exactly the same CloudEvent bytes", async () => {
		const binding = {
			fetch: vi
				.fn()
				.mockResolvedValueOnce(new Response(null, { status: 503 }))
				.mockResolvedValueOnce(acknowledged()),
		};
		const pending = deliverAnalyticsEvent(binding, event, ["distinct_id"]);
		await vi.advanceTimersByTimeAsync(101);
		expect(await pending).toMatchObject({
			status: "accepted",
			attempts: 2,
			event_id: "event-one",
		});
		expect(binding.fetch.mock.calls[0]?.[1].body).toBe(
			binding.fetch.mock.calls[1]?.[1].body,
		);
		expect(binding.fetch.mock.calls[0]?.[1].redirect).toBe("manual");
	});
	it("retries network errors and ambiguous receipts without accepting a mismatched identity", async () => {
		const binding = {
			fetch: vi
				.fn()
				.mockRejectedValueOnce(new Error("private-error-secret"))
				.mockResolvedValueOnce(acknowledged("persisted", "wrong-id"))
				.mockResolvedValueOnce(acknowledged()),
		};
		const pending = deliverAnalyticsEvent(binding, event, []);
		await vi.advanceTimersByTimeAsync(301);
		expect(await pending).toMatchObject({ status: "accepted", attempts: 3 });
		const bodies = binding.fetch.mock.calls.map((call) => call[1].body);
		expect(new Set(bodies).size).toBe(1);
	});
	it("does not mistake a legacy success response or 204 for confirmed persistence", async () => {
		for (const response of [
			() => Response.json({ success: true }),
			() => new Response(null, { status: 204 }),
		]) {
			const binding = { fetch: vi.fn().mockImplementation(response) };
			const pending = deliverAnalyticsEvent(binding, event, []);
			await vi.advanceTimersByTimeAsync(301);
			expect(await pending).toMatchObject({
				status: "failed",
				reason: "unconfirmed",
				attempts: 3,
			});
		}
	});
	it("does not retry permanent validation errors or follow redirects", async () => {
		for (const status of [400, 401, 403, 404, 302]) {
			const binding = {
				fetch: vi
					.fn()
					.mockResolvedValue(new Response("private-error-secret", { status })),
			};
			expect(await deliverAnalyticsEvent(binding, event, [])).toMatchObject({
				status: "failed",
				reason: "rejected",
				attempts: 1,
				http_status: status,
			});
			expect(binding.fetch).toHaveBeenCalledTimes(1);
		}
	});
	it("bounds hanging binding calls and response streams even if cancellation is ignored", async () => {
		for (const fetch of [
			vi.fn(() => new Promise<Response>(() => {})),
			vi.fn(
				async () =>
					new Response(new ReadableStream({ start() {} }), { status: 200 }),
			),
		]) {
			const started = Date.now();
			const pending = deliverAnalyticsEvent({ fetch }, event, []);
			await vi.advanceTimersByTimeAsync(2000);
			expect(await pending).toMatchObject({
				status: "failed",
				reason: "unavailable",
				attempts: 3,
			});
			expect(Date.now() - started).toBeLessThanOrEqual(2000);
			expect(fetch.mock.calls.length).toBe(3);
		}
	});
	it("caps oversized receipts, distinguishes filtering and makes unbound loss visible", async () => {
		const huge = {
			fetch: vi.fn().mockImplementation(() => new Response("x".repeat(9000))),
		};
		const pending = deliverAnalyticsEvent(huge, event, []);
		await vi.advanceTimersByTimeAsync(301);
		expect(await pending).toMatchObject({
			status: "failed",
			reason: "unconfirmed",
		});
		expect(
			await deliverAnalyticsEvent(
				{ fetch: vi.fn().mockResolvedValue(acknowledged("filtered")) },
				event,
				[],
			),
		).toMatchObject({ status: "filtered", attempts: 1 });
		expect(await deliverAnalyticsEvent(undefined, event, [])).toMatchObject({
			status: "failed",
			reason: "unbound",
			attempts: 0,
		});
		expect(
			JSON.stringify([
				...vi.mocked(console.info).mock.calls,
				...vi.mocked(console.warn).mock.calls,
			]),
		).not.toContain("never-log-this");
	});
	it("reports serialization rejection without calling the binding or leaking data", async () => {
		const cyclic = { ...event, cycle: undefined as unknown };
		cyclic.cycle = cyclic;
		const binding = { fetch: vi.fn() };
		expect(await deliverAnalyticsEvent(binding, cyclic, [])).toMatchObject({
			status: "failed",
			reason: "rejected",
			attempts: 0,
		});
		expect(binding.fetch).not.toHaveBeenCalled();
		expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
			"never-log-this",
		);
	});

	it("returns receipts for capture and identity calls and keeps linkage free of profile fields", async () => {
		const binding = {
			fetch: vi.fn().mockImplementation(async (_url, init) => {
				const body = JSON.parse(init.body);
				return Response.json({
					success: true,
					receipt: {
						version: 1,
						event_source: body.event.source,
						event_id: body.event.id,
						disposition: "persisted",
					},
				});
			}),
		};
		const capture = await captureServerEvent(
			{ event: "sign_in_completed", distinctId: "user-one" },
			binding,
		);
		const identify = await identifyServerUser(
			{ distinctId: "user-one", anonId: "anonymous-one" },
			binding,
		);
		expect(capture.status).toBe("accepted");
		expect(identify.status).toBe("accepted");
		const identity = JSON.parse(binding.fetch.mock.calls[1]?.[1].body);
		expect(identity.event.data).toEqual({
			distinct_id: "user-one",
			anon_id: "anonymous-one",
		});
		expect(identity.event.id).not.toBe(capture.event_id);
	});
});

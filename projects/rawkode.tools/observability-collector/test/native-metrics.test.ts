import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
	exportMetrics,
	metricsRequest,
	validateMetric,
} from "../src/native-metrics";
import {
	PermanentDeliveryError,
	RetryableDeliveryError,
} from "../src/delivery-queue";
const observation = {
	name: "github.stars",
	value: 42,
	attributes: {
		repository: "rawkode-academy/rawkode-academy",
		user_id: "private-person",
		email: "private@example.com",
		url: "https://example.com/?token=private",
	},
	timestamp: 1_800_000_000_123,
};
const config = {
	host: "https://metrics.example/otlp",
	instanceId: "1234",
	token: "private-write-token",
};
const originalFetch = globalThis.fetch;
let calls: ReturnType<typeof mock>;
beforeEach(() => {
	calls = mock(async () => Response.json({}));
	globalThis.fetch = Object.assign(calls, {
		preconnect: originalFetch.preconnect,
	});
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});
describe("native OTLP metrics", () => {
	test("exports gauge observations with exact nanoseconds and only bounded repository labels", () => {
		const request = metricsRequest([
			observation,
			{ ...observation, value: 43, timestamp: observation.timestamp + 1 },
		]);
		const metrics = request.resourceMetrics[0]!.scopeMetrics[0]!.metrics;
		expect(metrics).toHaveLength(1);
		expect(metrics[0]!.name).toBe("github.stars");
		expect(metrics[0]!.gauge.dataPoints[0]).toEqual({
			timeUnixNano: "1800000000123000000",
			asDouble: 42,
			attributes: [
				{
					key: "repository",
					value: { stringValue: "rawkode-academy/rawkode-academy" },
				},
			],
		});
		expect(metrics[0]!.gauge.dataPoints[1]!.asDouble).toBe(43);
		const output = JSON.stringify(request);
		for (const privateValue of [
			"private-person",
			"private@example.com",
			"token=private",
		])
			expect(output).not.toContain(privateValue);
		expect(output).not.toContain("aggregationTemporality");
	});
	test("rejects unsupported names/nonfinite observations and timestamp overflow before sending", async () => {
		for (const metric of [
			{ ...observation, name: "bad\n" },
			{ ...observation, name: "" },
			{ ...observation, value: NaN },
			{ ...observation, value: Infinity },
			{ ...observation, timestamp: 0 },
			{ ...observation, timestamp: 9007199254740991 },
		])
			await expect(exportMetrics(config, [metric])).rejects.toBeInstanceOf(
				PermanentDeliveryError,
			);
		expect(calls).not.toHaveBeenCalled();
		expect(() => validateMetric(observation)).not.toThrow();
		expect(
			metricsRequest([
				{ ...observation, attributes: { repository: "owner/repo\n" } },
			]).resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!.gauge.dataPoints[0]!
				.attributes,
		).toEqual([]);
	});
	test("uses the metrics endpoint and never follows redirects", async () => {
		await exportMetrics(config, [observation]);
		const [url, init] = calls.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe("https://metrics.example/otlp/v1/metrics");
		expect(init.redirect).toBe("manual");
		expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
		expect(JSON.parse(init.body as string)).toEqual(
			metricsRequest([observation]),
		);
	});
	test("retains permanent and partial rejection without automatic retry, and honors temporary backoff", async () => {
		for (const status of [400, 401, 403, 500, 302]) {
			calls.mockImplementationOnce(
				async () => new Response("private-provider-error", { status }),
			);
			await expect(exportMetrics(config, [observation])).rejects.toMatchObject({
				reason: "rejected",
				status,
			});
		}
		calls.mockImplementationOnce(async () =>
			Response.json({
				partialSuccess: {
					rejectedDataPoints: "1",
					errorMessage: "private-provider-error",
				},
			}),
		);
		await expect(exportMetrics(config, [observation])).rejects.toMatchObject({
			reason: "partial_success",
		});
		calls.mockImplementationOnce(async () =>
			Response.json({ partial_success: { rejected_data_points: "1" } }),
		);
		await expect(exportMetrics(config, [observation])).rejects.toMatchObject({
			reason: "partial_success",
		});
		calls.mockImplementationOnce(
			async () =>
				new Response(null, { status: 503, headers: { "retry-after": "120" } }),
		);
		await expect(exportMetrics(config, [observation])).rejects.toMatchObject({
			retryAfterMs: 120000,
		});
		calls.mockImplementationOnce(
			async () => new Response(null, { status: 429 }),
		);
		await expect(exportMetrics(config, [observation])).rejects.toBeInstanceOf(
			RetryableDeliveryError,
		);
	});
	test("does not mistake malformed, oversized or negative partial receipts for complete delivery", async () => {
		for (const response of [
			() => new Response("private-provider-error"),
			() => new Response("x".repeat(9000)),
			() => Response.json({ partialSuccess: { rejectedDataPoints: -1 } }),
			() => Response.json([]),
		]) {
			calls.mockImplementationOnce(async () => response());
			await expect(exportMetrics(config, [observation])).rejects.toMatchObject({
				reason: "invalid_response",
			});
		}
		calls.mockImplementationOnce(async () =>
			Response.json({
				partialSuccess: { rejectedDataPoints: "0", errorMessage: "warning" },
			}),
		);
		await expect(exportMetrics(config, [observation])).resolves.toBeUndefined();
	});
});

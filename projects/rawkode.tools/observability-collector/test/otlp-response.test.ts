import { describe, expect, test } from "bun:test";
import { acknowledgeOTLP } from "../src/otlp-response";
const protobuf = (bytes: number[]) =>
	new Response(new Uint8Array(bytes), {
		headers: { "content-type": "application/x-protobuf" },
	});
describe("OTLP acknowledgements", () => {
	test("acknowledges full JSON/binary success and zero-rejection warnings", async () => {
		await expect(
			acknowledgeOTLP(Response.json({}), "logs"),
		).resolves.toBeUndefined();
		await expect(
			acknowledgeOTLP(protobuf([]), "logs"),
		).resolves.toBeUndefined();
		await expect(
			acknowledgeOTLP(new Response(null), "logs", "application/x-protobuf"),
		).resolves.toBeUndefined();
		await expect(
			acknowledgeOTLP(
				Response.json({
					partialSuccess: {
						rejectedLogRecords: "0",
						errorMessage: "private-provider-message",
					},
				}),
				"logs",
			),
		).resolves.toBeUndefined();
		await expect(
			acknowledgeOTLP(protobuf([10, 2, 8, 0]), "logs"),
		).resolves.toBeUndefined();
	});
	test("never acknowledges JSON/protobuf partial rejection as delivered", async () => {
		for (const response of [
			Response.json({
				partialSuccess: {
					rejectedLogRecords: "1",
					errorMessage: "private-provider-message",
				},
			}),
			Response.json({ partial_success: { rejected_log_records: 1 } }),
			protobuf([10, 2, 8, 1]),
		]) {
			await expect(acknowledgeOTLP(response, "logs")).rejects.toMatchObject({
				reason: "partial_success",
			});
		}
	});
	test("preserves int64 rejection precision and rejects negative/overflow wire counts", async () => {
		await expect(
			acknowledgeOTLP(
				protobuf([10, 10, 8, 255, 255, 255, 255, 255, 255, 255, 255, 127]),
				"logs",
			),
		).rejects.toMatchObject({ reason: "partial_success" });
		await expect(
			acknowledgeOTLP(
				protobuf([10, 11, 8, 255, 255, 255, 255, 255, 255, 255, 255, 255, 1]),
				"logs",
			),
		).rejects.toMatchObject({ reason: "invalid_response" });
	});
	test("fails closed on truncated, oversized, duplicate and malformed wire envelopes", async () => {
		for (const bytes of [
			[128],
			[0],
			[10, 5, 8, 1],
			[10, 0, 10, 2, 8, 1],
			[10, 4, 8, 0, 8, 1],
			[11],
			[10, 1, 8],
			[10, 11, 8, 128, 128, 128, 128, 128, 128, 128, 128, 128, 2],
		]) {
			await expect(
				acknowledgeOTLP(protobuf(bytes), "logs"),
			).rejects.toMatchObject({ reason: "invalid_response" });
		}
		await expect(
			acknowledgeOTLP(protobuf(new Array(8193).fill(0)), "logs"),
		).rejects.toMatchObject({ reason: "invalid_response" });
	});
	test("skips bounded unknown proto3 fields without losing a known rejection", async () => {
		for (const bytes of [
			[16, 1, 10, 2, 8, 1],
			[17, 0, 0, 0, 0, 0, 0, 0, 0, 10, 2, 8, 1],
			[21, 0, 0, 0, 0, 10, 2, 8, 1],
			[18, 1, 0, 10, 2, 8, 1],
		])
			await expect(
				acknowledgeOTLP(protobuf(bytes), "logs"),
			).rejects.toMatchObject({ reason: "partial_success" });
	});
	test("refuses contradictory JSON aliases, wrong-signal counts and invalid MIME/JSON", async () => {
		for (const response of [
			Response.json({ partialSuccess: { rejectedDataPoints: 1 } }),
			Response.json({
				partialSuccess: { rejectedLogRecords: 0, rejected_log_records: 1 },
			}),
			Response.json({ partialSuccess: null }),
			Response.json({
				partialSuccess: { rejectedLogRecords: "9223372036854775808" },
			}),
			Response.json([]),
			new Response("private-response-body", {
				headers: { "content-type": "text/html" },
			}),
			new Response("{", { headers: { "content-type": "application/json" } }),
		]) {
			await expect(acknowledgeOTLP(response, "logs")).rejects.toMatchObject({
				reason: "invalid_response",
			});
		}
	});
	test("retries only OTLP transient status codes and never exposes provider error text", async () => {
		for (const status of [429, 502, 503, 504])
			await expect(
				acknowledgeOTLP(
					new Response("private-provider-message", {
						status,
						headers: { "retry-after": "120" },
					}),
					"logs",
				),
			).rejects.toMatchObject({ retryAfterMs: 120000 });
		for (const status of [400, 401, 403, 500, 302, 204]) {
			const response = new Response(
				status === 204 ? null : "private-provider-message",
				{ status },
			);
			try {
				await acknowledgeOTLP(response, "logs");
				throw Error("unexpected acknowledgement");
			} catch (error) {
				expect(error).toMatchObject({ reason: "rejected", status });
				expect(String(error)).not.toContain("private-provider-message");
			}
		}
	});
});

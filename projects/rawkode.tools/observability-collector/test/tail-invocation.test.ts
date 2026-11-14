import { expect, test } from "bun:test";
import { PermanentDeliveryError } from "../src/delivery-queue";
import { tailInvocationRecord } from "../src/tail-invocation";

test("quiet invocations preserve exact event timestamps and outcome without request data", () => {
	const trace = {
		scriptName: "fixture-worker",
		outcome: "exceededCpu",
		eventTimestamp: 1700000000123,
		request: { url: "https://private.example/secret?token=private" },
	};
	const record = tailInvocationRecord(trace, 1800000000000);
	expect(record.timeUnixNano).toBe("1700000000123000000");
	expect(record.attributes).toContainEqual({
		key: "worker.outcome",
		value: { stringValue: "exceededCpu" },
	});
	expect(JSON.stringify(record)).not.toContain("private");
});

test("missing event timestamps use the persisted acceptance time for stable replay", () => {
	const trace = { outcome: "ok" };
	expect(tailInvocationRecord(trace, 1700000000123)).toEqual(
		tailInvocationRecord(trace, 1700000000123),
	);
	expect(tailInvocationRecord(trace, 1700000000123).timeUnixNano).toBe(
		"1700000000123000000",
	);
});

test("invalid timestamps are retained as permanent failures rather than producing invalid OTLP", () => {
	for (const eventTimestamp of [
		NaN,
		Infinity,
		-1,
		1.5,
		Number.MAX_SAFE_INTEGER,
	]) {
		expect(() =>
			tailInvocationRecord({ outcome: "ok", eventTimestamp }, 1700000000000),
		).toThrow(PermanentDeliveryError);
	}
});

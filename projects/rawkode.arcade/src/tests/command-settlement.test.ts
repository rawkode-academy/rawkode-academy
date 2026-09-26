import { describe, expect, test } from "bun:test";
import { commandSettlement } from "../composables/use-room-socket";
import type { ServerEnvelope } from "../lib/live-contract";

const audienceEvent = (event: string): ServerEnvelope => ({
	v: 1,
	type: "event",
	version: 1,
	event,
	payload: {},
	commandId: "vote-1",
});

describe("command settlement", () => {
	test("keeps a queued audience vote pending until authoritative acceptance", () => {
		expect(commandSettlement(audienceEvent("audience.queued"))).toBe("pending");
		expect(commandSettlement(audienceEvent("audience.accepted"))).toBe("accepted");
	});

	test("makes a later command-scoped audience rejection retryable", () => {
		const queued = audienceEvent("audience.queued");
		const rejected: ServerEnvelope = {
			v: 1,
			type: "error",
			code: "CONFLICT",
			message: "DISTRIBUTION_FROZEN",
			commandId: "vote-1",
		};
		expect(commandSettlement(queued)).toBe("pending");
		expect(commandSettlement(rejected)).toBe("rejected");
	});

	test("accepts direct gameplay events but not unrelated audience telemetry", () => {
		expect(commandSettlement(audienceEvent("answer.submit"))).toBe("accepted");
		expect(commandSettlement(audienceEvent("audience.aggregated"))).toBeUndefined();
	});
});

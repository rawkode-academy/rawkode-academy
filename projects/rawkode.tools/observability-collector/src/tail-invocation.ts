import { PermanentDeliveryError } from "./delivery-queue";

/** A quiet invocation still needs an outcome record; never include request data. */
export function tailInvocationRecord(
	trace: { scriptName?: string; outcome: string; eventTimestamp?: number },
	acceptedAt: number,
) {
	const timestamp = trace.eventTimestamp ?? acceptedAt;
	if (!Number.isSafeInteger(timestamp) || timestamp < 0)
		throw new PermanentDeliveryError("invalid_payload");
	const nanos = BigInt(timestamp) * 1_000_000n;
	if (nanos > 18446744073709551615n)
		throw new PermanentDeliveryError("invalid_payload");
	return {
		timeUnixNano: nanos.toString(),
		severityNumber: 9,
		severityText: "INFO",
		body: { stringValue: "Worker invocation" },
		attributes: [
			{ key: "event.name", value: { stringValue: "worker.invocation" } },
			{
				key: "worker.name",
				value: { stringValue: trace.scriptName ?? "unknown" },
			},
			{ key: "worker.outcome", value: { stringValue: trace.outcome } },
		],
	};
}

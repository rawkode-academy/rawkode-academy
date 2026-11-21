import {
	PermanentDeliveryError,
	RetryableDeliveryError,
} from "./delivery-queue";
const MAX_BODY = 8192;
const MAX_INT64 = 9223372036854775807n;
function invalid(): never {
	throw new PermanentDeliveryError("invalid_response");
}
function retryAfter(value: string | null): number | undefined {
	if (!value) return;
	const delay = /^\d+$/.test(value)
		? Number(value) * 1000
		: Date.parse(value) - Date.now();
	return Number.isFinite(delay) && delay >= 0 && delay <= 86_400_000
		? delay
		: undefined;
}
async function boundedBody(response: Response) {
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader(),
		chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const next = await reader.read();
			if (next.done) break;
			size += next.value.byteLength;
			if (size > MAX_BODY) {
				await reader.cancel();
				invalid();
			}
			chunks.push(next.value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}
function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
	return value as Record<string, unknown>;
}
function alias(input: Record<string, unknown>, camel: string, snake: string) {
	if (input[camel] !== undefined && input[snake] !== undefined) invalid();
	return input[camel] !== undefined ? input[camel] : input[snake];
}
function jsonRejected(bytes: Uint8Array, signal: "logs" | "metrics") {
	let payload: unknown;
	try {
		payload = JSON.parse(
			new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes),
		);
	} catch {
		invalid();
	}
	const partial = alias(record(payload), "partialSuccess", "partial_success");
	if (partial === undefined) return 0n;
	const body = record(partial);
	const wrongSignal =
		signal === "logs"
			? ["rejectedDataPoints", "rejected_data_points"]
			: ["rejectedLogRecords", "rejected_log_records"];
	if (wrongSignal.some((key) => body[key] !== undefined)) invalid();
	const value =
		alias(
			body,
			signal === "logs" ? "rejectedLogRecords" : "rejectedDataPoints",
			signal === "logs" ? "rejected_log_records" : "rejected_data_points",
		) ?? 0;
	if (
		!(typeof value === "number" && Number.isSafeInteger(value) && value >= 0) &&
		!(typeof value === "string" && /^\d{1,19}$/.test(value))
	)
		invalid();
	const count = BigInt(value);
	if (count > MAX_INT64) invalid();
	return count;
}
// Only the two-level Export*ServiceResponse/PartialSuccess envelope is decoded.
// Unknown proto3 scalar fields are skipped; no unbounded lengths or recursion.
class Wire {
	position = 0;
	constructor(readonly bytes: Uint8Array) {}
	get done() {
		return this.position === this.bytes.length;
	}
	varint() {
		let result = 0n;
		for (let i = 0; i < 10; i++) {
			const byte = this.bytes[this.position++];
			if (byte === undefined || (i === 9 && byte > 1)) invalid();
			result |= BigInt(byte & 127) << BigInt(i * 7);
			if ((byte & 128) === 0) return result;
		}
		return invalid();
	}
	field() {
		const tag = this.varint(),
			id = tag >> 3n;
		if (id < 1n || id > 536870911n) invalid();
		return { id: Number(id), wire: Number(tag & 7n) };
	}
	message() {
		const length = this.varint();
		if (length > BigInt(this.bytes.length - this.position)) invalid();
		const end = this.position + Number(length);
		const value = this.bytes.subarray(this.position, end);
		this.position = end;
		return value;
	}
	skip(wire: number) {
		if (wire === 0) {
			this.varint();
			return;
		}
		if (wire === 2) {
			this.message();
			return;
		}
		const length = wire === 1 ? 8 : wire === 5 ? 4 : invalid();
		if (this.position + length > this.bytes.length) invalid();
		this.position += length;
	}
}
function protobufRejected(bytes: Uint8Array) {
	const response = new Wire(bytes);
	let partial: Uint8Array | undefined;
	while (!response.done) {
		const field = response.field();
		if (field.id === 1) {
			if (field.wire !== 2 || partial !== undefined) invalid();
			partial = response.message();
		} else response.skip(field.wire);
	}
	if (partial === undefined) return 0n;
	const body = new Wire(partial);
	let rejected: bigint | undefined;
	while (!body.done) {
		const field = body.field();
		if (field.id === 1) {
			if (field.wire !== 0 || rejected !== undefined) invalid();
			rejected = body.varint();
			if (rejected > MAX_INT64) invalid();
		} else body.skip(field.wire);
	}
	return rejected ?? 0n;
}
const mime = (value: string) => value.split(";")[0]?.trim().toLowerCase();
/** A 200 can reject records. Never acknowledge partial/permanent rejection. */
export async function acknowledgeOTLP(
	response: Response,
	signal: "logs" | "metrics",
	requestType = "application/json",
) {
	if (response.status !== 200) {
		await response.body?.cancel();
		if ([429, 502, 503, 504].includes(response.status))
			throw new RetryableDeliveryError(
				retryAfter(response.headers.get("retry-after")),
			);
		throw new PermanentDeliveryError("rejected", response.status);
	}
	const encoding = mime(response.headers.get("content-type") ?? requestType);
	const bytes = await boundedBody(response);
	const rejected =
		encoding === "application/json"
			? jsonRejected(bytes, signal)
			: encoding === "application/x-protobuf"
				? protobufRejected(bytes)
				: invalid();
	// OTLP forbids automatic retries of partial-success responses; retain for triage.
	if (rejected > 0n) throw new PermanentDeliveryError("partial_success");
}

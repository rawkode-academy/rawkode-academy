import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	MACHINE_AUTH_TEST_VECTOR,
	canonicalQuery,
	canonicalRequest,
	sha256Hex,
	signMachineRequest,
} from "./machine-auth";

describe("Studio machine authentication", () => {
	it("signs Payload's shared test vector byte for byte", async () => {
		const vector = MACHINE_AUTH_TEST_VECTOR;
		expect(canonicalRequest({
			method: vector.method,
			path: vector.path,
			query: canonicalQuery(vector.query),
			principal: vector.principal,
			timestamp: vector.timestamp,
			idempotencyKey: vector.idempotencyKey,
			bodySha256: await sha256Hex(vector.body),
		})).toBe(vector.canonical);
		const headers = await signMachineRequest(vector.secret, {
			method: vector.method,
			path: vector.path,
			query: vector.query,
			timestamp: vector.timestamp,
			idempotencyKey: vector.idempotencyKey,
			body: vector.body,
		});
		expect(headers).toEqual({
			"x-rawkode-principal": "rawkode-studio",
			"x-rawkode-timestamp": "1760000000",
			"idempotency-key": vector.idempotencyKey,
			"x-rawkode-signature": vector.signature,
		});
	});

	it("matches Payload's copy of the vector", () => {
		const payload = readFileSync(
			new URL("../../../rawkode.academy/payload/src/machine-auth.ts", import.meta.url),
			"utf8",
		);
		expect(payload).toContain(`signature: '${MACHINE_AUTH_TEST_VECTOR.signature}'`);
		expect(payload).toContain(`secret: '${MACHINE_AUTH_TEST_VECTOR.secret}'`);
		expect(payload).toContain(`timestamp: ${MACHINE_AUTH_TEST_VECTOR.timestamp},`);
	});
});

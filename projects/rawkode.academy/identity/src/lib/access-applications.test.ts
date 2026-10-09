import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
	ACCESS_APPLICATIONS,
	findAccessRole,
	ROLE_KEYS,
} from "./access-applications";

const authSource = readFileSync(new URL("./auth.ts", import.meta.url), "utf8");
const trustedClientIds = new Set(
	[...authSource.matchAll(/clientId:\s*"([^"]+)"/g)].map((match) => match[1]),
);

describe("access applications", () => {
	test("Payload exposes the staff role", () => {
		expect(
			findAccessRole("rawkode-academy-payload", ROLE_KEYS.staff),
		).toBeDefined();
	});

	test("Studio exposes the studio_operator role", () => {
		expect(
			findAccessRole("rawkode-studio", ROLE_KEYS.studioOperator),
		).toBeDefined();
	});

	test("client_approver is not an identity role", () => {
		expect(
			findAccessRole("rawkode-academy-payload", "client_approver"),
		).toBeUndefined();
	});

	test("every application is a trusted OIDC client", () => {
		for (const app of ACCESS_APPLICATIONS) {
			expect(trustedClientIds.has(app.clientId)).toBe(true);
		}
	});
});

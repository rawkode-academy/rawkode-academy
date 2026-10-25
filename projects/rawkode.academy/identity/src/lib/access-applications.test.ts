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
	test("Studio exposes the studio_operator role", () => {
		expect(
			findAccessRole("rawkode-studio", ROLE_KEYS.studioOperator),
		).toBeDefined();
	});

	test("client_approver is not an identity role", () => {
		expect(
			findAccessRole("rawkode-studio", "client_approver"),
		).toBeUndefined();
	});

	test("every application is a trusted OIDC client", () => {
		for (const app of ACCESS_APPLICATIONS) {
			expect(trustedClientIds.has(app.clientId)).toBe(true);
		}
	});
});

describe("CMS access", () => {
	test("the CMS client exposes the content roles the CMS reads", () => {
		for (const role of ["content_admin", "content_guest", "content_partner"]) {
			expect(findAccessRole("rawkode-academy-cms", role)).toBeDefined();
		}
	});
});

import { describe, expect, test } from "bun:test";
import { getUserAccessClaims } from "./access-claims";

// getUserAccessClaims only chains select().from().where().orderBy().
const dbWith = (roles: string[]) =>
	({
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: async () => roles.map((role) => ({ role })),
				}),
			}),
		}),
	}) as never;

describe("getUserAccessClaims", () => {
	test("returns the roles under every claim name for the client", async () => {
		const claims = await getUserAccessClaims(dbWith(["operator"]), "u", "rawkode-tools-mcp");
		expect(claims).toEqual({
			roles: ["operator"],
			groups: ["operator"],
			"https://rawkode.academy/roles": ["operator"],
			"https://rawkode.academy/client_id": "rawkode-tools-mcp",
		});
	});

	// Better Auth's userinfo encoder turns a repeated object reference into the
	// string "[Circular ref-1]", which broke every reader of the namespaced claim.
	test("never shares one array between claims", async () => {
		const claims = await getUserAccessClaims(dbWith(["operator", "admin"]), "u", "c");
		const arrays = [claims.roles, claims.groups, claims["https://rawkode.academy/roles"]];
		expect(new Set(arrays).size).toBe(3);
		for (const array of arrays) expect(Array.isArray(array)).toBe(true);
	});

	test("returns no claims without roles", async () => {
		expect(await getUserAccessClaims(dbWith([]), "u", "c")).toEqual({});
	});
});

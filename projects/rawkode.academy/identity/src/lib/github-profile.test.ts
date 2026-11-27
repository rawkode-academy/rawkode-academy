import { describe, expect, test } from "bun:test";
import {
	isOrgRole,
	lookupGithubProfile,
	normaliseGithubLogin,
} from "./github-profile";

describe("normaliseGithubLogin", () => {
	test("accepts a handle with or without @", () => {
		expect(normaliseGithubLogin("rawkode")).toBe("rawkode");
		expect(normaliseGithubLogin("  @rawkode ")).toBe("rawkode");
		expect(normaliseGithubLogin("a-b-1")).toBe("a-b-1");
	});

	test("rejects anything that is not a GitHub login", () => {
		for (const bad of ["", "-a", "a-", "a--b", "a b", "a/b", "a".repeat(40), "a@b.c"]) {
			expect(normaliseGithubLogin(bad)).toBeNull();
		}
	});
});

describe("isOrgRole", () => {
	test("knows the Better Auth organisation roles", () => {
		expect(isOrgRole("owner")).toBe(true);
		expect(isOrgRole("member")).toBe(true);
		expect(isOrgRole("root")).toBe(false);
		expect(isOrgRole(undefined)).toBe(false);
	});
});

describe("lookupGithubProfile", () => {
	const reply = (status: number, body: unknown) =>
		(async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

	test("returns the numeric id as a string", async () => {
		expect(
			await lookupGithubProfile("rawkode", reply(200, { id: 145816, login: "rawkode" })),
		).toEqual({ id: "145816", login: "rawkode" });
	});

	test("unknown login is null, other failures throw", async () => {
		expect(await lookupGithubProfile("nobody", reply(404, {}))).toBeNull();
		await expect(lookupGithubProfile("x", reply(403, {}))).rejects.toThrow();
		await expect(lookupGithubProfile("x", reply(200, { login: "x" }))).rejects.toThrow();
	});
});

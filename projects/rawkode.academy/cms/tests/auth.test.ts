import { describe, expect, test } from "bun:test";
import {
	returnToFromState,
	rolesFromClaims,
	safeReturnTo,
} from "../src/lib/auth";

describe("sign-in redirects", () => {
	test("keep same-site paths", () => {
		expect(safeReturnTo("/c/technologies/bun?tab=history#x")).toBe(
			"/c/technologies/bun?tab=history#x",
		);
		expect(safeReturnTo("/c/course-modules/a%2Fb")).toBe(
			"/c/course-modules/a%2Fb",
		);
	});

	test("refuse anything that leaves the site", () => {
		for (const path of [
			"//evil.com",
			"/\\evil.com",
			"/\t/evil.com",
			"/\n/evil.com",
			"https://evil.com",
			"evil.com",
			"",
			null,
		]) {
			expect(safeReturnTo(path)).toBe("/");
		}
	});

	test("state round-trips the return path", () => {
		const encoded = btoa("/c/videos").replace(/=+$/, "");
		expect(returnToFromState(`nonce.${encoded}`)).toBe("/c/videos");
		expect(returnToFromState(`nonce.${btoa("//evil.com")}`)).toBe("/");
	});
});

test("only content roles are read from claims", () => {
	expect(
		rolesFromClaims({
			"https://rawkode.academy/roles": ["content_admin", "studio_operator"],
		}),
	).toEqual(["content_admin"]);
	expect(rolesFromClaims({ roles: "content_admin" })).toEqual([]);
});

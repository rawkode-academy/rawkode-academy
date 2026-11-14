import { expect, test } from "bun:test";
import { tailRequestOrigin } from "../src/tail-privacy";

test("tail URLs retain only origin, removing credentials, paths, queries and fragments", () => {
	expect(
		tailRequestOrigin(
			"https://user:password@example.com/auth/code/private?token=secret#identity",
		),
	).toBe("https://example.com");
	expect(
		tailRequestOrigin(
			"http://localhost:8787/user/private?email=private@example.com",
		),
	).toBe("http://localhost:8787");
});

test("invalid, oversized and non-HTTP tail URLs are omitted", () => {
	for (const input of [
		undefined,
		"",
		"/relative?token=secret",
		"invalid",
		"file:///private",
		"data:text/plain,private",
		`https://example.com/${"x".repeat(8192)}`,
	]) {
		expect(tailRequestOrigin(input)).toBeUndefined();
	}
});

test("origin redaction is stable across replay and canonicalizes the host", () => {
	const result = tailRequestOrigin(
		"https://EXAMPLE.COM:443/path?private=value",
	);
	expect(result).toBe("https://example.com");
	expect(tailRequestOrigin(result)).toBe(result);
});

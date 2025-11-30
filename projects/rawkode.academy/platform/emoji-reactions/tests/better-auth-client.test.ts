import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { getAuthCookies, getSession } from "../write-model/better-auth-client";

describe("getAuthCookies", () => {
	it("should return empty string when cookies string is empty", () => {
		expect(getAuthCookies("")).toBe("");
	});

	it("should return empty string when no auth cookies present", () => {
		expect(getAuthCookies("session=abc; other=123")).toBe("");
	});

	it("should extract better-auth. prefixed cookies", () => {
		expect(getAuthCookies("better-auth.session_token=abc123")).toBe(
			"better-auth.session_token=abc123",
		);
	});

	it("should extract __Secure-better-auth. prefixed cookies", () => {
		expect(getAuthCookies("__Secure-better-auth.session_token=xyz789")).toBe(
			"__Secure-better-auth.session_token=xyz789",
		);
	});

	it("should extract multiple auth cookies", () => {
		const cookies =
			"better-auth.session_token=abc; __Secure-better-auth.session_token=xyz";
		const result = getAuthCookies(cookies);
		expect(result).toContain("better-auth.session_token=abc");
		expect(result).toContain("__Secure-better-auth.session_token=xyz");
	});

	it("should filter out non-auth cookies from mixed input", () => {
		const cookies =
			"other=xyz; better-auth.session_token=abc; another=123; __Secure-better-auth.csrf=def";
		const result = getAuthCookies(cookies);
		expect(result).toBe(
			"better-auth.session_token=abc; __Secure-better-auth.csrf=def",
		);
		expect(result).not.toContain("other=xyz");
		expect(result).not.toContain("another=123");
	});

	it("should handle cookies with extra whitespace", () => {
		const cookies = "  better-auth.token=abc  ;  other=xyz  ;  __Secure-better-auth.csrf=def  ";
		const result = getAuthCookies(cookies);
		expect(result).toBe("better-auth.token=abc; __Secure-better-auth.csrf=def");
	});

	it("should handle cookies with special characters in values", () => {
		const cookies = "better-auth.session_token=abc+def/ghi=jkl";
		expect(getAuthCookies(cookies)).toBe("better-auth.session_token=abc+def/ghi=jkl");
	});
});

describe("getSession", () => {
	const originalFetch = global.fetch;

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it("should return null when no auth cookies present", async () => {
		const result = await getSession("session=abc; other=123");
		expect(result).toBeNull();
	});

	it("should return null when cookies string is empty", async () => {
		const result = await getSession("");
		expect(result).toBeNull();
	});

	it("should call identity provider with correct headers", async () => {
		let capturedRequest: { url: string; options: RequestInit } | null = null;

		global.fetch = mock(async (url: string, options?: RequestInit) => {
			capturedRequest = { url: url.toString(), options: options || {} };
			return new Response(JSON.stringify({ user: null }), { status: 200 });
		}) as typeof fetch;

		await getSession("better-auth.session_token=test123");

		expect(capturedRequest).not.toBeNull();
		expect(capturedRequest!.url).toBe("https://id.rawkode.academy/auth/get-session");
		expect(capturedRequest!.options.method).toBe("GET");
		expect(capturedRequest!.options.headers).toEqual({
			Cookie: "better-auth.session_token=test123",
			Origin: "https://rawkode.academy",
		});
	});

	it("should return null when response is not ok", async () => {
		global.fetch = mock(async () => {
			return new Response("Unauthorized", { status: 401 });
		}) as typeof fetch;

		const result = await getSession("better-auth.session_token=invalid");
		expect(result).toBeNull();
	});

	it("should return null when response has no user", async () => {
		global.fetch = mock(async () => {
			return new Response(JSON.stringify({ user: null }), { status: 200 });
		}) as typeof fetch;

		const result = await getSession("better-auth.session_token=test");
		expect(result).toBeNull();
	});

	it("should return session data when valid", async () => {
		const mockSession = {
			user: {
				id: "user-123",
				email: "test@example.com",
				emailVerified: true,
				name: "Test User",
				image: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
			session: {
				id: "session-456",
				userId: "user-123",
				expiresAt: new Date(),
				ipAddress: null,
				userAgent: null,
			},
		};

		global.fetch = mock(async () => {
			return new Response(JSON.stringify(mockSession), { status: 200 });
		}) as typeof fetch;

		const result = await getSession("better-auth.session_token=valid");
		expect(result).not.toBeNull();
		expect(result!.user.id).toBe("user-123");
		expect(result!.user.email).toBe("test@example.com");
	});

	it("should return null when fetch throws an error", async () => {
		global.fetch = mock(async () => {
			throw new Error("Network error");
		}) as typeof fetch;

		const result = await getSession("better-auth.session_token=test");
		expect(result).toBeNull();
	});
});

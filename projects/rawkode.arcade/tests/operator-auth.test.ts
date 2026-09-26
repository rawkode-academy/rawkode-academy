import { expect, test } from "bun:test";
import { authenticateOperator } from "../src/server/identity";
import { mutationOriginAllowed } from "../src/server/origin";
import type { Env } from "../src/env";

function environment(userId?: string, role = "host") {
	const calls: { url?: string; cookie?: string; origin?: string; subject?: string } = {};
	const env = {
		IDENTITY: {
			fetch: async (url: string, init: RequestInit) => {
				calls.url = url;
				calls.cookie = new Headers(init.headers).get("cookie") ?? undefined;
				calls.origin = new Headers(init.headers).get("origin") ?? undefined;
				return Response.json(userId ? { user: { id: userId } } : null);
			},
		},
		DB: {
			prepare: () => ({
				bind: (subject: string) => {
					calls.subject = subject;
					return { first: async () => role ? { id: "operator-1", role, display_name: "Academy host" } : null };
				},
			}),
		},
	} as unknown as Env;
	return { env, calls };
}

test("uses the live Academy session and an active operator row", async () => {
	const { env, calls } = environment("academy-user-1");
	const request = new Request("https://play.rawkode.academy/api/rooms", {
		headers: { cookie: "other=ignored; __Secure-better-auth.session_token=opaque; better-auth.session_data=cached" },
	});
	expect(await authenticateOperator(request, env)).toEqual({ id: "operator-1", role: "host", displayName: "Academy host" });
	expect(calls.url).toBe("https://id.rawkode.academy/auth/get-session?disableCookieCache=true");
	expect(calls.cookie).toBe("__Secure-better-auth.session_token=opaque");
	expect(calls.origin).toBe("https://play.rawkode.academy");
	expect(calls.subject).toBe("academy:academy-user-1");
});

test("does not grant an operator role without a valid session and table row", async () => {
	const { env } = environment();
	expect(await authenticateOperator(new Request("https://play.rawkode.academy/api/rooms"), env)).toBeUndefined();
	expect(await authenticateOperator(new Request("https://play.rawkode.academy/api/rooms", {
		headers: { cookie: "better-auth.session_token=opaque" },
	}), env)).toBeUndefined();
	const missingRow = environment("academy-user-1", "");
	expect(await authenticateOperator(new Request("https://play.rawkode.academy/api/rooms", {
		headers: { cookie: "better-auth.session_token=opaque" },
	}), missingRow.env)).toBeUndefined();
});

test("requires the exact origin for deployed mutations", () => {
	const url = "https://play.rawkode.academy/api/rooms";
	for (const origin of [undefined, "null", "https://rawkode.academy", "https://evil.example"]) {
		const request = new Request(url, { method: "POST", headers: origin ? { origin } : {} });
		expect(mutationOriginAllowed(request, { ENVIRONMENT: "production" })).toBe(false);
		expect(mutationOriginAllowed(request, { ENVIRONMENT: "preview" })).toBe(false);
	}
	expect(mutationOriginAllowed(new Request(url, { method: "POST", headers: { origin: "https://play.rawkode.academy" } }), { ENVIRONMENT: "production" })).toBe(true);
	expect(mutationOriginAllowed(new Request(url, { method: "POST" }), { ENVIRONMENT: "test" })).toBe(true);
});

import { ActionError, defineAction } from "astro:actions";
import { z } from "astro:schema";
import { getProxyableHeaders } from "@/lib/http";

interface Cookie {
	name: string;
	value: string;
	path?: string;
	expires?: Date;
	maxAge?: number;
	domain?: string;
	secure?: boolean;
	httpOnly?: boolean;
	sameSite?: boolean | "lax" | "strict" | "none";
}

type JsonRecord = Record<string, unknown>;
type CookieOptionFields = Omit<Cookie, "name" | "value">;

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null;
}

function getStringProperty(record: JsonRecord, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

type HeadersWithGetSetCookie = Headers & {
	getSetCookie?: () => string[];
};

function getSetCookieHeaders(headers: Headers): string[] {
	const headerWithGetter = headers as HeadersWithGetSetCookie;
	if (typeof headerWithGetter.getSetCookie === "function") {
		return headerWithGetter.getSetCookie();
	}
	const header = headers.get("Set-Cookie");
	return header ? [header] : [];
}

function parseSetCookieString(str: string): Cookie | null {
	const parts = str.split(";").map((p) => p.trim());
	const nameValue = parts[0];
	if (!nameValue) return null;

	const options = parts.slice(1);
	const separatorIndex = nameValue.indexOf("=");
	if (separatorIndex === -1) return null;

	const name = nameValue.substring(0, separatorIndex);
	const value = nameValue.substring(separatorIndex + 1);

	const cookie: Cookie = { name, value };

	for (const option of options) {
		const [key, ...valParts] = option.split("=");
		if (!key) continue;
		
		const val = valParts.join("=");
		const lowerKey = key.toLowerCase();

		if (lowerKey === "path") cookie.path = val;
		else if (lowerKey === "domain") cookie.domain = val;
		else if (lowerKey === "max-age") cookie.maxAge = Number.parseInt(val, 10);
		else if (lowerKey === "expires") cookie.expires = new Date(val);
		else if (lowerKey === "secure") cookie.secure = true;
		else if (lowerKey === "httponly") cookie.httpOnly = true;
		else if (lowerKey === "samesite") {
			const sameSite = val.toLowerCase();
			if (["lax", "strict", "none"].includes(sameSite)) {
				cookie.sameSite = sameSite as "lax" | "strict" | "none";
			}
		}
	}

	return cookie;
}

export const auth = {
	signInWithGithub: defineAction({
		input: z.object({
			callbackURL: z.string().optional(),
		}),
		handler: async (input, context) => {
			const authService = context.locals.runtime?.env?.AUTH_SERVICE;
			if (!authService) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Auth service not configured",
				});
			}

			const url = new URL(
				"/auth/sign-in/social",
				"https://rawkode.academy",
			);

			// Filter out headers that shouldn't be forwarded
			const headers = getProxyableHeaders(context.request.headers);

			// Ensure callbackURL is absolute
			const callbackURL = new URL(input.callbackURL || "/", "https://rawkode.academy").toString();

			const response = await authService.fetch(url.toString(), {
				method: "POST",
				headers: {
					...Object.fromEntries(headers.entries()),
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					provider: "github",
					callbackURL,
				}),
			});

			let responseData: JsonRecord = {};
			try {
				const text = await response.text();
				if (text && text.length > 0) {
					const parsed: unknown = JSON.parse(text);
					if (isRecord(parsed)) {
						responseData = parsed;
					}
				}
			} catch (_error) {
				console.error("Failed to parse auth service response");
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Invalid response from auth service",
				});
			}

			if (!response.ok) {
				// Include the status and text in the error for debugging
				const errorMessage =
					getStringProperty(responseData, "message") ||
					getStringProperty(responseData, "error") ||
					`Auth service failed with ${response.status}`;
				throw new ActionError({
					code: "BAD_REQUEST",
					message: errorMessage,
				});
			}

			// Forward Set-Cookie headers
			const setCookieHeaders = getSetCookieHeaders(response.headers);
			for (const header of setCookieHeaders) {
				const cookie = parseSetCookieString(header);
				if (cookie) {
					// Construct options object to satisfy exactOptionalPropertyTypes
					const cookieOptions: CookieOptionFields = {};
					if (cookie.domain) cookieOptions.domain = cookie.domain;
					if (cookie.expires) cookieOptions.expires = cookie.expires;
					if (cookie.httpOnly !== undefined) cookieOptions.httpOnly = cookie.httpOnly;
					if (cookie.maxAge !== undefined) cookieOptions.maxAge = cookie.maxAge;
					if (cookie.path) cookieOptions.path = cookie.path;
					if (cookie.sameSite) cookieOptions.sameSite = cookie.sameSite;
					if (cookie.secure !== undefined) cookieOptions.secure = cookie.secure;

					context.cookies.set(cookie.name, cookie.value, cookieOptions);
				}
			}

			const redirectUrl = getStringProperty(responseData, "url");
			if (!redirectUrl) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Auth service response missing redirect URL",
				});
			}

			return { url: redirectUrl };
		},
	}),
	signOut: defineAction({
		handler: async (_, context) => {
			const authService = context.locals.runtime?.env?.AUTH_SERVICE;
			if (!authService) {
				throw new ActionError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Auth service not configured",
				});
			}

			// Filter out headers that shouldn't be forwarded
			const headers = getProxyableHeaders(context.request.headers);

			const response = await authService.fetch(
				"https://auth.internal/auth/sign-out",
				{
					method: "POST",
					headers,
				},
			);

			// Forward Set-Cookie headers
			const setCookieHeaders = getSetCookieHeaders(response.headers);
			for (const header of setCookieHeaders) {
				const cookie = parseSetCookieString(header);
				if (cookie) {
					// Construct options object to satisfy exactOptionalPropertyTypes
					const cookieOptions: CookieOptionFields = {};
					if (cookie.domain) cookieOptions.domain = cookie.domain;
					if (cookie.expires) cookieOptions.expires = cookie.expires;
					if (cookie.httpOnly !== undefined) cookieOptions.httpOnly = cookie.httpOnly;
					if (cookie.maxAge !== undefined) cookieOptions.maxAge = cookie.maxAge;
					if (cookie.path) cookieOptions.path = cookie.path;
					if (cookie.sameSite) cookieOptions.sameSite = cookie.sameSite;
					if (cookie.secure !== undefined) cookieOptions.secure = cookie.secure;

					context.cookies.set(cookie.name, cookie.value, cookieOptions);
				}
			}

			return { success: response.ok };
		},
	}),
};

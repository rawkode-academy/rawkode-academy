// Which requests and responses must never be stored by the shared CDN cache.
// The Workers cache key ignores cookies, so a page rendered differently for
// one visitor would be served to everyone.

/**
 * Cookies the server reads to render something visitor-specific: sign-in
 * sessions (locals.user), the Astro session (anonymous course sign-ups), and
 * the newsletter / lead-magnet flags that hide CTAs for anonymous visitors.
 */
export const PERSONALISING_COOKIES: ReadonlyArray<string | RegExp> = [
	"rawkode-session",
	/^(__Secure-)?better-auth\./,
	"astro-session",
	/^newsletter:/,
	/^lead-magnet:/,
];

export function hasPersonalisingCookie(
	cookieHeader: string | null | undefined,
): boolean {
	if (!cookieHeader) return false;
	for (const part of cookieHeader.split(";")) {
		const eq = part.indexOf("=");
		let name = (eq === -1 ? part : part.slice(0, eq)).trim();
		if (!name) continue;
		try {
			name = decodeURIComponent(name);
		} catch {}
		const value = eq === -1 ? "" : part.slice(eq + 1).trim();
		if (!value) continue;
		if (
			PERSONALISING_COOKIES.some((m) =>
				typeof m === "string" ? m === name : m.test(name),
			)
		) {
			return true;
		}
	}
	return false;
}

const CDN_HEADER = "Cloudflare-CDN-Cache-Control";

function isShareable(value: string | null): boolean {
	if (!value) return false;
	return !/\b(no-store|private)\b/i.test(value);
}

/**
 * Last line of defence in the Worker entrypoint: a response that sets a
 * cookie, that was rendered for a request carrying a personalising cookie,
 * or that is an error (status >= 400), is never stored by the CDN, whatever
 * the page asked for. Astro applies Astro.cache.set() options to whatever
 * response the route produces, so a page or endpoint that set its cache and
 * then failed (gateway outage, a 404 after the lookup) would otherwise pin
 * that error at the edge for maxAge + swr.
 */
export function guardSharedCache(
	request: Request,
	response: Response,
): Response {
	if (!isShareable(response.headers.get(CDN_HEADER))) return response;
	const setsCookie =
		typeof response.headers.getSetCookie === "function"
			? response.headers.getSetCookie().length > 0
			: response.headers.has("set-cookie");
	if (
		response.status < 400 &&
		!setsCookie &&
		!hasPersonalisingCookie(request.headers.get("cookie"))
	) {
		return response;
	}
	const apply = (target: Response) => {
		target.headers.set(CDN_HEADER, "no-store");
		target.headers.delete("Cache-Tag");
	};
	try {
		apply(response);
		return response;
	} catch {
		// Immutable headers (e.g. a response from the Cache API).
		const copy = new Response(response.body, response);
		apply(copy);
		return copy;
	}
}

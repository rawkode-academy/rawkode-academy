// Astro prefetches every link in the viewport, sign-in links included. A
// prefetch must not count as a sign-in attempt or replace the PKCE verifier of
// a sign-in already in flight. Browsers mark speculative loads with a purpose
// header; Astro's fetch() fallback is caught because it isn't a navigation.
export function isPrefetch(request: Request): boolean {
	const purpose =
		request.headers.get("sec-purpose") ??
		request.headers.get("purpose") ??
		request.headers.get("x-moz") ??
		"";
	if (/prefetch|prerender/i.test(purpose)) return true;
	const mode = request.headers.get("sec-fetch-mode");
	return mode !== null && mode !== "navigate";
}

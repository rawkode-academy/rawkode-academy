// In-page timestamp links use a fragment (#t=SECONDS), not a query string.
// Crawlers ignore fragments, so a transcript with hundreds of timestamps no
// longer mints hundreds of crawlable /watch/...?t=N duplicates. ?t= is still
// read on load: shared links and the key-moment URLs in VideoObject JSON-LD
// use it.

export function timestampHref(seconds: number): string {
	return `#t=${Math.max(0, Math.floor(seconds))}`;
}

function parseSeconds(value: string | null | undefined): number | undefined {
	if (!value || !/^\d+$/.test(value)) return undefined;
	const seconds = Number(value);
	return Number.isSafeInteger(seconds) ? seconds : undefined;
}

/** Start time from #t=SECONDS, falling back to ?t=SECONDS. */
export function startTimeFromUrl(url: URL): number | undefined {
	const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
	return (
		parseSeconds(fragment.get("t")) ?? parseSeconds(url.searchParams.get("t"))
	);
}

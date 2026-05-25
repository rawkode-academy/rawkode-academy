export function normalizeUrl(url: string): string {
	const parsed = new URL(url);
	let pathname = parsed.pathname;
	if (pathname.length > 1 && pathname.endsWith("/")) {
		pathname = pathname.slice(0, -1);
	}
	return `${parsed.protocol}//${parsed.host}${pathname}`;
}

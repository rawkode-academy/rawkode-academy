/** Tail request URLs can contain credentials, login codes and personal paths. */
export function tailRequestOrigin(
	value: string | undefined,
): string | undefined {
	if (!value || value.length > 8192) return;
	try {
		const url = new URL(value);
		if (url.protocol !== "https:" && url.protocol !== "http:") return;
		return url.origin;
	} catch {
		return;
	}
}

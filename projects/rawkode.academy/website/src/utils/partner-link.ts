/**
 * Outbound links to a partner (a collaborator or a supporter) carry UTM
 * parameters, so the company can attribute the visit to the Academy:
 *
 *   utm_source=rawkode.academy
 *   utm_medium=<where the link sits: "collaboration-credit", "supporter">
 *   utm_campaign=<the page it sits on: a video slug, a course id, "supporters">
 *   utm_content=<optional finer placement, such as a lesson slug>
 *
 * A UTM parameter the partner already set in their URL is kept: they asked for
 * that attribution. A URL that does not parse is returned unchanged.
 */
export interface PartnerLinkPlacement {
	medium: string;
	campaign: string;
	content?: string | undefined;
}

export const PARTNER_LINK_SOURCE = "rawkode.academy";

export function partnerLink(url: string, placement: PartnerLinkPlacement): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;
	const params: [string, string | undefined][] = [
		["utm_source", PARTNER_LINK_SOURCE],
		["utm_medium", placement.medium],
		["utm_campaign", placement.campaign],
		["utm_content", placement.content],
	];
	for (const [key, value] of params) {
		if (value && !parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
	}
	return parsed.toString();
}

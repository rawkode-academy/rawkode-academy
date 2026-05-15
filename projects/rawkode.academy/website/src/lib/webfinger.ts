export interface ParsedAcctResource {
	user: string;
	domain: string;
}

export interface ParsedMastodonProfile {
	instance: string;
	username: string;
	profileUrl: string;
	actorUrl: string;
}

export interface WebfingerLink {
	rel: string;
	type?: string;
	href: string;
}

export interface WebfingerResponse {
	subject: string;
	aliases: string[];
	links: WebfingerLink[];
}

/**
 * Parse an `acct:` URI as specified in RFC 7565.
 * Accepts `acct:user@domain` and returns null for any other shape.
 */
export function parseAcctResource(
	resource: string | null | undefined,
): ParsedAcctResource | null {
	if (typeof resource !== "string") return null;
	if (!resource.startsWith("acct:")) return null;
	const rest = resource.slice("acct:".length);
	const atIndex = rest.lastIndexOf("@");
	if (atIndex <= 0 || atIndex === rest.length - 1) return null;
	const user = rest.slice(0, atIndex);
	const domain = rest.slice(atIndex + 1);
	if (!user || !domain) return null;
	if (!/^[A-Za-z0-9._-]+$/.test(user)) return null;
	return { user, domain: domain.toLowerCase() };
}

/**
 * Parse a Mastodon-style profile URL (`https://instance.tld/@user`) into the
 * components Webfinger needs. Returns null for unparseable input.
 */
export function parseMastodonProfile(
	profileUrl: string | undefined,
): ParsedMastodonProfile | null {
	if (typeof profileUrl !== "string" || profileUrl.length === 0) return null;
	let parsed: URL;
	try {
		parsed = new URL(profileUrl);
	} catch {
		return null;
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

	const match = parsed.pathname.match(/^\/@([A-Za-z0-9._-]+)\/?$/);
	if (!match) return null;
	const username = match[1] as string;

	return {
		instance: parsed.host,
		username,
		profileUrl: `${parsed.protocol}//${parsed.host}/@${username}`,
		actorUrl: `${parsed.protocol}//${parsed.host}/users/${username}`,
	};
}

/**
 * Build the Webfinger JRD payload that Mastodon-compatible servers expect
 * when resolving `@user@domain`. The `subject` echoes the request resource,
 * which is required by RFC 7033.
 */
export function buildWebfingerResponse(input: {
	subject: string;
	displayName: string;
	mastodonProfile: ParsedMastodonProfile;
	homepage?: string;
}): WebfingerResponse {
	const { subject, mastodonProfile, homepage } = input;
	const aliases = [mastodonProfile.profileUrl, mastodonProfile.actorUrl];
	const links: WebfingerLink[] = [
		{
			rel: "self",
			type: "application/activity+json",
			href: mastodonProfile.actorUrl,
		},
		{
			rel: "http://webfinger.net/rel/profile-page",
			type: "text/html",
			href: mastodonProfile.profileUrl,
		},
	];
	if (homepage) {
		aliases.push(homepage);
	}
	return { subject, aliases, links };
}

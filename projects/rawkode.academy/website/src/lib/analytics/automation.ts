// Request-level checks that keep crawlers, previews and scanners out of
// analytics. The collector also drops bots by user agent and hosting network;
// these checks need the request headers, which only the website sees.

/** The only origin whose traffic is analytics. Previews run on workers.dev. */
export const PRODUCTION_HOST = "rawkode.academy";

/** Previews, local development and other ports (scanners use :8443) aren't counted. */
export function isProductionUrl(url: URL): boolean {
	return (
		url.hostname === PRODUCTION_HOST &&
		url.protocol === "https:" &&
		url.port === ""
	);
}

type BotManagement = { score?: number; verifiedBot?: boolean };

function cfProperties(
	request: Request,
):
	| (IncomingRequestCfProperties & { botManagement?: BotManagement })
	| undefined {
	return (request as Request & { cf?: IncomingRequestCfProperties }).cf as
		| (IncomingRequestCfProperties & { botManagement?: BotManagement })
		| undefined;
}

/** Cloudflare's ASN for the client, which the collector checks against hosting networks. */
export function clientAsn(request: Request): number | undefined {
	const asn = cfProperties(request)?.asn;
	return typeof asn === "number" ? asn : undefined;
}

// Chromium has sent `sec-ch-ua` on every secure request since Chrome 89.
// Samsung Internet and Android WebView are left out: support there is newer.
const CHROMIUM = /Chrome\/(\d+)\./;
const CHROMIUM_WITHOUT_HINTS = /SamsungBrowser|; wv\)/;

/**
 * Why a request looks automated, or null when it looks like a person.
 * Signals: Cloudflare's verdict (present only with Bot Management), a headless
 * Chromium brand, and a Chrome user agent without Chrome's client hints, which
 * means the user agent is spoofed.
 */
export function automatedRequestReason(request: Request): string | null {
	const bot = cfProperties(request)?.botManagement;
	if (bot?.verifiedBot) return "verified-bot";
	if (bot?.score !== undefined && bot.score > 0 && bot.score < 30)
		return "bot-score";

	const hints = request.headers.get("sec-ch-ua");
	if (hints && /headless/i.test(hints)) return "headless";

	const ua = request.headers.get("user-agent") ?? "";
	const chrome = CHROMIUM.exec(ua);
	if (
		chrome &&
		Number(chrome[1]) >= 100 &&
		!CHROMIUM_WITHOUT_HINTS.test(ua) &&
		hints === null
	)
		return "spoofed-chrome";

	return null;
}

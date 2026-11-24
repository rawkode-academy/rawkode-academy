// Request-level checks that label crawlers, previews and scanners in
// analytics. Nothing is dropped: the collector stores every event with `bot`
// and `botreason`, adding its own user-agent and hosting-network rules. These
// checks need the request headers and host, which only the website sees.

/** The only origin whose traffic is analytics. Previews run on workers.dev. */
export const PRODUCTION_HOST = "rawkode.academy";

/** Previews, local development and other ports (scanners use :8443) are labelled `non-production`. */
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
function automatedRequestReason(request: Request): string | null {
	const bot = cfProperties(request)?.botManagement;
	if (bot?.verifiedBot) return "cf-verified-bot";
	if (bot?.score !== undefined && bot.score > 0 && bot.score < 30)
		return "cf-bot-score";

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

/** The website's bot verdict for a request, or undefined for a person. */
export function botReason(request: Request): string | undefined {
	if (!isProductionUrl(new URL(request.url))) return "non-production";
	return automatedRequestReason(request) ?? undefined;
}

import cloudNativeCompass from "./cloudnativecompass.fm";
import klusteredLive from "./klustered.live";
import rawkodeChat from "./rawkode.chat";
import rawkodeCommunity from "./rawkode.community";
import rawkodeLink from "./rawkode.link";
import rawkodeLive from "./rawkode.live";
import type { Redirects } from "./types";

const redirects: Redirects = {
	defaultRedirect: "https://rawkode.academy",
	domains: {
		"cloudnativecompass.fm": cloudNativeCompass,
		"klustered.live": klusteredLive,
		"rawkode.chat": rawkodeChat,
		"rawkode.community": rawkodeCommunity,
		"rawkode.link": rawkodeLink,
		"rawkode.live": rawkodeLive,
	},
};

interface Env {
	ANALYTICS: Fetcher;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const requestUrl = new URL(request.url);

		const hostname = requestUrl.hostname;
		const path = requestUrl.pathname.substring(1);

		if (path === "healthcheck") {
			return new Response("OK", {
				status: 200,
			});
		}

		const domain = own(redirects.domains, hostname);
		const link = domain && own(domain.redirects, path);
		const destination =
			link?.to ?? domain?.defaultRedirect ?? redirects.defaultRedirect;

		// Every hit is recorded; bots are labelled, not dropped. Unmatched paths
		// are scanners probing for wp-includes/ and .env (46 of 31,989 hits
		// matched a link, Nov 2026), so they are labelled too. A domain's root is
		// a real entry point.
		const matched = link !== undefined;
		const entryPoint = matched || (domain !== undefined && path === "");
		ctx.waitUntil(
			trackShortLink(
				env,
				request,
				{ domain: hostname, path, matched, destination },
				cloudflareVerdict(request) ??
					(entryPoint ? undefined : "unmatched-path"),
			),
		);

		return Response.redirect(destination);
	},
};

// Paths come from the request, so a path like "constructor" must not match
// anything inherited from Object.prototype.
const own = <T>(record: Record<string, T>, key: string): T | undefined =>
	Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

/**
 * Cloudflare's verdict, present only on zones with Bot Management. A score of
 * 0 means it wasn't computed. The collector adds its own user-agent and
 * hosting-network rules.
 */
const cloudflareVerdict = (request: Request): string | undefined => {
	const bot = (
		request.cf as
			| { botManagement?: { score: number; verifiedBot: boolean } }
			| undefined
	)?.botManagement;
	if (bot?.verifiedBot) return "cf-verified-bot";
	if (bot && bot.score > 0 && bot.score < 30) return "cf-bot-score";
	return undefined;
};

const trackShortLink = async (
	env: Env,
	request: Request,
	data: {
		domain: string;
		path: string;
		matched: boolean;
		destination: string;
	},
	botReason: string | undefined,
) => {
	// Request context travels as CloudEvents extension attributes. The
	// collector turns `useragent` into device and browser, labels bots and
	// hosting networks with `bot` and `botreason`, and never stores the raw
	// string.
	const event: Record<string, unknown> = {
		specversion: "1.0",
		type: "shortLink",
		source: "rawkode-link",
		id: crypto.randomUUID(),
		time: new Date().toISOString(),
		useragent: request.headers.get("User-Agent") ?? "",
		data,
	};
	const referrer = request.headers.get("Referer");
	if (referrer) event.referrer = referrer;
	if (request.cf?.country) event.country = request.cf.country as string;
	if (request.cf?.continent) event.continent = request.cf.continent as string;
	if (typeof request.cf?.asn === "number") event.asn = request.cf.asn;
	if (botReason) event.botreason = botReason;

	// Log the id, not the payload: it carries the raw user agent, and these
	// logs are exported to Grafana.
	console.log("Sending analytics event", { id: event.id });

	const response = await env.ANALYTICS.fetch("https://analytics/track", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ event }),
	});

	if (!response.ok) {
		const body = await response.text();
		console.error("Analytics tracking failed", {
			status: response.status,
			body,
			id: event.id,
		});
	}
};

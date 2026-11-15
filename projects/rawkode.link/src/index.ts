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

		if (!isBot(request)) {
			ctx.waitUntil(
				trackShortLink(env, request, {
					domain: hostname,
					path,
					matched: link !== undefined,
					destination,
				}),
			);
		}

		return Response.redirect(destination);
	},
};

// Paths come from the request, so a path like "constructor" must not match
// anything inherited from Object.prototype.
const own = <T>(record: Record<string, T>, key: string): T | undefined =>
	Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

/**
 * Cloudflare's verdict, present only on zones with Bot Management. A score of
 * 0 means it wasn't computed. Without a verdict, the collector drops bots by
 * user agent.
 */
const isBot = (request: Request): boolean => {
	const bot = (
		request.cf as
			| { botManagement?: { score: number; verifiedBot: boolean } }
			| undefined
	)?.botManagement;
	return (
		bot !== undefined && (bot.verifiedBot || (bot.score > 0 && bot.score < 30))
	);
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
) => {
	// Request context travels as CloudEvents extension attributes. The
	// collector turns `useragent` into device and browser, drops bots, and
	// never stores the raw string.
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

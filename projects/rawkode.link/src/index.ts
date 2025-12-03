import cloudNativeCompass from "./cloudnativecompass.fm";
import rawkodeChat from "./rawkode.chat";
import rawkodeCommunity from "./rawkode.community";
import rawkodeLink from "./rawkode.link";
import rawkodeLive from "./rawkode.live";
import type { Redirects } from "./types";

const redirects: Redirects = {
	defaultRedirect: "https://rawkode.academy",
	domains: {
		"cloudnativecompass.fm": cloudNativeCompass,
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

		const hostname = requestUrl.host;
		const path = requestUrl.pathname.substring(1);

		if (path === "healthcheck") {
			return new Response("OK", {
				status: 200,
			});
		}

		ctx.waitUntil(logAnalytics(env, request, hostname, path));

		if (!(hostname in redirects["domains"])) {
			return Response.redirect(redirects.defaultRedirect);
		}

		const domain = redirects["domains"][hostname];

		if (path in domain["redirects"]) {
			return Response.redirect(domain["redirects"][path].to);
		}

		return Response.redirect(domain.defaultRedirect);
	},
};

const logAnalytics = async (
	env: Env,
	request: Request,
	hostname: string,
	path: string,
) => {
	const event = {
		specversion: "1.0",
		type: "link.redirect",
		source: `https://${hostname}`,
		id: crypto.randomUUID(),
		time: new Date().toISOString(),
		data: {
			path,
			referrer: request.headers.get("Referer") || "",
			country: (request.cf?.country as string) || "",
			continent: (request.cf?.continent as string) || "",
		},
	};

	const payload = {
		event,
		attributes: ["path", "country", "continent"],
	};

	console.log("Sending analytics event", { payload });

	const response = await env.ANALYTICS.fetch("https://analytics/track", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = await response.text();
		console.error("Analytics tracking failed", {
			status: response.status,
			body,
			event,
		});
	}
};

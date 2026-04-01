import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { captureServerEvent, getDistinctId } from "@/server/analytics";

const SKIP_PREFIXES = ["/api/", "/_server-islands/", "/_actions/", "/_image"];

const BOT_RE =
	/bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|linkedinbot|twitterbot|applebot/i;

export const analyticsMiddleware = defineMiddleware(async (context, next) => {
	const response = await next();

	if (context.request.method !== "GET") return response;
	if (context.isPrerendered) return response;

	const accept = context.request.headers.get("accept") ?? "";
	if (!accept.includes("text/html")) return response;

	const pathname = context.url.pathname;
	if (SKIP_PREFIXES.some((p) => pathname.startsWith(p))) return response;

	const ua = context.request.headers.get("user-agent") ?? "";
	if (BOT_RE.test(ua)) return response;

	const analytics = (env as Record<string, unknown>).ANALYTICS as
		| Fetcher
		| undefined;
	if (!analytics) return response;

	const distinctId = getDistinctId(context);

	captureServerEvent(
		{
			event: "page_view",
			distinctId: distinctId ?? "anonymous",
			properties: {
				path: pathname,
				referrer: context.request.headers.get("referer") ?? "",
				user_agent: ua,
				source: "server",
			},
		},
		analytics,
	).catch(() => {});

	return response;
});

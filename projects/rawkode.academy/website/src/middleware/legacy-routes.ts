import { defineMiddleware } from "astro:middleware";
import { resolveApplicationPath } from "@/lib/partnerships";
import { resolveLegacyPersonRedirect } from "./legacy-person-redirects";

type LegacyRouteResult =
	| {
			kind: "redirect";
			status: 301 | 302;
			location: string;
	  }
	| {
			kind: "empty";
			status: 204;
			headers: Record<string, string>;
	  };

const PERMANENT_REDIRECTS = new Map<string, string>([
	["/events", "/watch"],
	["/community-day", "/about"],
	["/metal", "/technology/equinix-metal"],
	["/organizations", "/organizations/partnerships"],
	["/organizations/consulting", "/organizations/partnerships"],
	["/organizations/training", "/organizations/partnerships"],
	// Article series were retired; the Talos on Hetzner series never shipped.
	["/series", "/read"],
	["/series/talos-on-hetzner", "/read"],
]);

export function resolveLegacyRoute(url: URL): LegacyRouteResult | undefined {
	const pathname =
		url.pathname.length > 1 && url.pathname.endsWith("/")
			? url.pathname.slice(0, -1)
			: url.pathname;

	// Older combined-offer links carried the supporter choice on the
	// partnership URL. Keep those links pointed at the matching new page.
	if (
		pathname === "/organizations/partnerships" &&
		resolveApplicationPath(url.searchParams.get("route")) === "Support Our Work"
	) {
		const target = new URL("/organizations/support-our-work", url);
		target.search = url.search;
		target.hash = url.hash;
		return { kind: "redirect", status: 302, location: target.toString() };
	}

	const permanentTarget = PERMANENT_REDIRECTS.get(pathname);
	if (permanentTarget) {
		return {
			kind: "redirect",
			status: 301,
			location: new URL(permanentTarget, url).toString(),
		};
	}

	const personTarget = resolveLegacyPersonRedirect(pathname);
	if (personTarget) {
		return {
			kind: "redirect",
			status: 301,
			location: new URL(personTarget, url).toString(),
		};
	}

	if (pathname === "/sign-in") {
		const target = new URL("/api/auth/sign-in", url);
		for (const [key, value] of url.searchParams) {
			target.searchParams.append(key, value);
		}
		return {
			kind: "redirect",
			status: 302,
			location: target.toString(),
		};
	}

	if (pathname === "/_partytown/partytown-sandbox-sw.html") {
		return {
			kind: "empty",
			status: 204,
			headers: {
				"Cache-Control": "public, max-age=3600",
				"X-Robots-Tag": "noindex, nofollow",
			},
		};
	}

	return undefined;
}

export const legacyRoutesMiddleware = defineMiddleware((context, next) => {
	const result = resolveLegacyRoute(context.url);
	if (!result) {
		return next();
	}

	if (result.kind === "redirect") {
		return Response.redirect(result.location, result.status);
	}

	return new Response(null, {
		status: result.status,
		headers: result.headers,
	});
});

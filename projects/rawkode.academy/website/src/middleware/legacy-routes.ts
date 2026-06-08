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

type MiddlewareContext = {
	url: URL;
};

type MiddlewareNext = () => Response | Promise<Response>;

const PERMANENT_REDIRECTS = new Map<string, string>([
	["/events", "/watch"],
	["/community-day", "/about"],
	["/metal", "/technology/equinix-metal"],
	["/organizations/consulting", "/organizations/partnerships"],
	["/organizations/training", "/organizations/partnerships"],
]);

export function resolveLegacyRoute(url: URL): LegacyRouteResult | undefined {
	const pathname =
		url.pathname.length > 1 && url.pathname.endsWith("/")
			? url.pathname.slice(0, -1)
			: url.pathname;

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

export const legacyRoutesMiddleware = (
	context: MiddlewareContext,
	next: MiddlewareNext,
) => {
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
};

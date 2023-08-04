import { Redirects } from "./types";
import rawkodeLink from "./rawkode.link";
import rawkodeCommunity from "./rawkode.community";

const redirects: Redirects = {
	defaultRedirect: "https://twitter.com/rawkode",
	domains: {
		"rawkode.link": rawkodeLink,
		"rawkode.community": rawkodeCommunity,
	},
};

interface Env {
	RUDDERSTACK_AUTH: string;
}

const handler = async (
	request: Request,
	env: Env,
	ctx: ExecutionContext,
): Promise<Response> => {
	const requestUrl = new URL(request.url);

	console.log(`Request for ${requestUrl.host}`);

	const hostname = requestUrl.host;
	const path = requestUrl.pathname.substring(1);

	console.log(`Handling request on domain '${hostname}' for '${path}'`);

	ctx.waitUntil(logRequest(request, env, hostname, path));

	if (!(hostname in redirects["domains"])) {
		console.log("This domain is not managed by rawkode.link");
		return Response.redirect(redirects.defaultRedirect);
	}

	const domain = redirects["domains"][hostname];

	if (path in domain["redirects"]) {
		console.log(`Redirecting too '${domain["redirects"][path].to}'`);
		return Response.redirect(domain["redirects"][path].to);
	}

	console.log("Path not found, default redirect");

	return Response.redirect(domain.defaultRedirect);
};

const logRequest = async (
	request: Request,
	env: Env,
	hostname: string,
	path: string,
) => {
	console.log("Sending to Rudderstack");

	const headers = new Headers();

	headers.set("Content-Type", "application/json");
	headers.set("Authorization", `Basic ${env.RUDDERSTACK_AUTH}`);

	const logRequest = new Request(
		"https://rawkodedaoo.dataplane.rudderstack.com/v1/track",
		{
			method: "POST",
			headers,
			body: JSON.stringify({
				anonymousId: request.headers.get("CF-Connecting-IP") || "IP Unknown",
				event: "click",
				properties: {
					shortDomain: hostname,
					shortPath: path,

					referrer: request.headers.get("Referer") || "",
				},
				context: {
					ipAddr: request.headers.get("CF-Connecting-IP") || "Unknown IP",
					geoLatitude: request.cf?.latitude,
					geoLongitude: request.cf?.longitude,
					geoContinentCode: request.cf?.continent,
					geoCountryCode: request.cf?.country,
					geoCityName: request.cf?.city,
					geoSubdivision1Code: request.cf?.regionCode,
					geoSubdivision1Name: request.cf?.region,
					geopostalCode: request.cf?.postalCode,
					geoTimezone: request.cf?.timezone,
				},
			}),
		},
	);

	const response = await fetch(logRequest);

	console.debug(response);
};

export default handler;

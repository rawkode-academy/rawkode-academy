import { Point } from "@influxdata/influxdb-client";
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
	INFLUXDB_TOKEN: string;
}

export default {
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const requestUrl = new URL(request.url);

		console.log(`Request for ${requestUrl.host}`);

		const hostname = requestUrl.host;
		const path = requestUrl.pathname.substring(1);

		ctx.waitUntil(logRequest(request, env, hostname, path));

		console.log(`Handling request on domain '${hostname}' for '${path}'`);

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
	},
};

const logRequest = async (
	request: Request,
	env: Env,
	hostname: string,
	path: string,
) => {
	console.log("Sending to InfluxDB");

	const referrer = request.headers.get("Referer") || "";

	const headers = new Headers();

	headers.set("Authorization", `Token ${env.INFLUXDB_TOKEN}`);

	const point = new Point("click")
		.tag("domain", hostname)
		.tag("path", path)
		.tag("referrer", referrer)
		.tag("continentCode", getContinentString(request))
		.tag("countryCode", getCountryString(request))
		.intField("count", 1);

	const logRequest = new Request(
		"https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/write?bucket=analytics",
		{
			method: "POST",
			headers,
			body: point.toLineProtocol(),
		},
	);

	const response = await fetch(logRequest);

	if (response.status !== 204) {
		console.log(`Analytics Push Failed: ${response.status}`);
		console.log(await response.text());
	}
};

const getCountryString = (request: Request): string => {
	if (undefined === request.cf) {
		return "";
	}

	if (typeof request.cf.country !== "string") {
		return "";
	}

	return request.cf.country;
};

const getContinentString = (request: Request): string => {
	if (undefined === request.cf) {
		return "";
	}

	if (typeof request.cf.continent !== "string") {
		return "";
	}

	return request.cf.continent;
};

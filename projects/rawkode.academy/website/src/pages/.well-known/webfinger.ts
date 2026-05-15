import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import {
	buildWebfingerResponse,
	parseAcctResource,
	parseMastodonProfile,
} from "@/lib/webfinger";

const SITE_DOMAIN = "rawkode.academy";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
};

function badRequest(message: string): Response {
	return new Response(message, {
		status: 400,
		headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
	});
}

function notFound(): Response {
	return new Response("Not Found", {
		status: 404,
		headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders },
	});
}

export const OPTIONS: APIRoute = () =>
	new Response(null, { status: 204, headers: corsHeaders });

export const GET: APIRoute = async ({ url, site }) => {
	const resource = url.searchParams.get("resource");
	const parsed = parseAcctResource(resource);
	if (!parsed) {
		return badRequest("Missing or malformed resource= query parameter.");
	}

	const expectedDomain = (site?.host ?? SITE_DOMAIN).toLowerCase();
	if (parsed.domain !== expectedDomain) {
		return notFound();
	}

	const people = await getCollection("people");
	const person = people.find((entry) => entry.data.id === parsed.user);
	if (!person) {
		return notFound();
	}

	const mastodonProfile = parseMastodonProfile(person.data.mastodon);
	if (!mastodonProfile) {
		return notFound();
	}

	const subject = `acct:${parsed.user}@${parsed.domain}`;
	const homepage = new URL(
		`/people/${person.data.id}`,
		site ?? `https://${SITE_DOMAIN}`,
	).href;
	const jrd = buildWebfingerResponse({
		subject,
		displayName: person.data.name,
		mastodonProfile,
		homepage,
	});

	return new Response(JSON.stringify(jrd), {
		status: 200,
		headers: {
			"Content-Type": "application/jrd+json; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=86400",
			...corsHeaders,
		},
	});
};

export const prerender = false;

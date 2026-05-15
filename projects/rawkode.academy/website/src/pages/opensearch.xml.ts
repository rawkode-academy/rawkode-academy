import type { APIRoute } from "astro";

const DEFAULT_SITE_URL = "https://rawkode.academy";

export function renderOpenSearchDescription(site: URL | string): string {
	const base = new URL(typeof site === "string" ? site : site.toString());
	const searchUrl = new URL("/search?q={searchTerms}", base).href;
	const selfUrl = new URL("/opensearch.xml", base).href;
	const favicon16 = new URL("/favicon-16x16.png", base).href;
	const favicon32 = new URL("/favicon-32x32.png", base).href;

	return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/"
                       xmlns:moz="http://www.mozilla.org/2006/browser/search/">
  <ShortName>Rawkode Academy</ShortName>
  <LongName>Search Rawkode Academy</LongName>
  <Description>Search videos, articles, news, courses, and people across Rawkode Academy.</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/png">${favicon16}</Image>
  <Image width="32" height="32" type="image/png">${favicon32}</Image>
  <Url type="text/html" method="get" template="${searchUrl}"/>
  <Url type="application/opensearchdescription+xml" rel="self" template="${selfUrl}"/>
  <moz:SearchForm>${new URL("/search", base).href}</moz:SearchForm>
</OpenSearchDescription>`;
}

export const GET: APIRoute = ({ site }) => {
	const siteUrl = site ?? new URL(DEFAULT_SITE_URL);
	const body = renderOpenSearchDescription(siteUrl);
	return new Response(body, {
		headers: {
			"Content-Type": "application/opensearchdescription+xml; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};

export const prerender = true;

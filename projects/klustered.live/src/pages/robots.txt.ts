import type { APIRoute } from "astro";

export const GET: APIRoute = () =>
	new Response(
		[
			"User-agent: *",
			"Allow: /",
			"",
			"Sitemap: https://klustered.live/sitemap.xml",
			"",
		].join("\n"),
		{
			headers: {
				"content-type": "text/plain; charset=utf-8",
				"cache-control": "public, max-age=3600",
			},
		},
	);

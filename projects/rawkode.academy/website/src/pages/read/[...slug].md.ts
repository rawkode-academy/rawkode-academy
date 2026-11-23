import type { APIContext } from "astro";
import {
	articleCanonicalUrl,
	articleToMarkdown,
} from "@/lib/article-markdown";
import { getEntries, getEntry, setContentCache } from "@/lib/live-content";

export const prerender = false;

export async function GET(context: APIContext) {
	const slug = context.params.slug?.replace(/^\/+|\/+$/g, "");
	const article = slug ? await getEntry("articles", slug) : undefined;
	if (!article) return new Response(null, { status: 404 });

	const authors = await getEntries(article.data.authors);

	await setContentCache(context, { entries: [article, ...authors] });

	const canonicalUrl = articleCanonicalUrl(article, context.site).replace(
		/\/+$/,
		"",
	);

	return new Response(
		await articleToMarkdown(article, authors, context.site),
		{
			headers: {
				"Content-Type": "text/markdown; charset=utf-8",
				Link: `<${canonicalUrl}>; rel="canonical"`,
			},
		},
	);
}

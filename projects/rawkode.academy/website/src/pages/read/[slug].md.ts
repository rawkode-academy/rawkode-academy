import { getEntry, getEntries } from "@/lib/payload-content";
import type { APIContext } from "astro";
import { articleToMarkdown } from "@/lib/article-markdown";

export const prerender = false;

export async function GET({ params, site }: APIContext) {
	const article = params.slug
		? await getEntry("articles", { slug: params.slug })
		: undefined;
	if (!article || article.data.publishedAt > new Date()) {
		return new Response(null, { status: 404 });
	}
	const authors = await getEntries(article.data.authors);

	return new Response(articleToMarkdown(article, authors, site), {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control": "public, max-age=60, s-maxage=60",
		},
	});
}

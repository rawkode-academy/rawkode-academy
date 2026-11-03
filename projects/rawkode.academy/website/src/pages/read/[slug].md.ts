import type { APIContext } from "astro";
import { articleToMarkdown } from "@/lib/article-markdown";
import { getEntries, getEntry, setContentCache } from "@/lib/live-content";

export const prerender = false;

export async function GET(context: APIContext) {
	const slug = context.params.slug;
	const article = slug ? await getEntry("articles", slug) : undefined;
	if (!article) return new Response(null, { status: 404 });

	const authors = await getEntries(article.data.authors);

	await setContentCache(context, { entries: [article, ...authors] });

	return new Response(await articleToMarkdown(article, authors, context.site), {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});
}

import { getCollection, getEntries } from "astro:content";
import type { CollectionEntry } from "astro:content";
import type { APIContext, GetStaticPaths } from "astro";
import { articleToMarkdown } from "@/lib/article-markdown";

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
	const articles = await getCollection("articles", ({ data }) => !data.draft);
	return articles.map((article) => ({
		params: { slug: article.id },
		props: { article },
	}));
};

type Props = {
	article: CollectionEntry<"articles">;
};

export async function GET({ props, site }: APIContext) {
	const { article } = props as Props;
	const authors = await getEntries(article.data.authors);

	return new Response(articleToMarkdown(article, authors, site), {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
		},
	});
}

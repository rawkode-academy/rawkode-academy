import { getCollection, getEntries } from "astro:content";
import type { APIContext } from "astro";

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (char) => {
		switch (char) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return char;
		}
	});
}

export async function GET(context: APIContext) {
	const news = await getCollection("news");

	const sortedNews = [...news].sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	const site = context.site?.toString() || "https://rawkode.academy";
	const feedUrl = `${site}/api/feeds/news.atom`;

	const lastUpdated =
		sortedNews[0]?.data.publishedAt instanceof Date
			? sortedNews[0].data.publishedAt.toISOString()
			: new Date().toISOString();

	const entries = await Promise.all(
		sortedNews.map(async (story) => {
			const storyUrl = `${site}/news/${story.id}/`;
			const published = new Date(story.data.publishedAt).toISOString();
			const authors = await getEntries(story.data.authors);

			const authorTags = authors
				.map(
					(author) =>
						`<author><name>${escapeXml(author.data.name)}</name></author>`,
				)
				.join("\n\t\t");

			const categoryTags = (story.data.technologies ?? [])
				.map((technology) => `<category term="${escapeXml(technology)}"/>`)
				.join("\n\t\t");

			return `	<entry>
		<title><![CDATA[${story.data.title}]]></title>
		<link href="${storyUrl}" rel="alternate" type="text/html"/>
		<id>${storyUrl}</id>
		<published>${published}</published>
		<updated>${published}</updated>
		<summary><![CDATA[${story.data.description}]]></summary>
		<content type="html"><![CDATA[${story.data.description}]]></content>
		${authorTags}
		${categoryTags}
	</entry>`;
		}),
	);

	const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Rawkode Academy - News</title>
	<subtitle>Cloud native, Kubernetes, and AI infrastructure news for engineers.</subtitle>
	<link href="${feedUrl}" rel="self" type="application/atom+xml"/>
	<link href="${site}/news" rel="alternate" type="text/html"/>
	<id>${site}/news</id>
	<updated>${lastUpdated}</updated>
	<generator>Astro</generator>
${entries.join("\n")}
</feed>`;

	return new Response(atomFeed, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
			"Cache-Control": "public, max-age=900",
		},
	});
}

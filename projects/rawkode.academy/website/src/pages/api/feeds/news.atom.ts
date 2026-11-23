import type { APIContext } from "astro";
import {
	type ContentEntry,
	getCollection,
	getEntries,
	setContentCache,
} from "@/lib/live-content";
import { isNewsPublished } from "@/lib/news-publication";

import {
	DEFAULT_FEED_AUTHOR,
	escapeAttribute,
	escapeCdata,
	escapeXml,
	normalizeSiteUrl,
} from "../../../lib/feed-utils";

export async function GET(context: APIContext) {
	const now = new Date();
	const news = await getCollection("news", ({ data }) =>
		isNewsPublished(data.publishedAt, now),
	);

	const sortedNews = [...news].sort(
		(a, b) =>
			new Date(b.data.publishedAt).getTime() -
			new Date(a.data.publishedAt).getTime(),
	);

	const site = normalizeSiteUrl(context.site);
	const feedUrl = `${site}/api/feeds/news.atom`;

	const lastUpdated =
		sortedNews[0]?.data.publishedAt instanceof Date
			? sortedNews[0].data.publishedAt.toISOString()
			: now.toISOString();

	const authorEntries: ContentEntry<"people">[] = [];
	const entries = await Promise.all(
		sortedNews.map(async (story) => {
			const storyUrl = `${site}/news/${story.id}`;
			const published = new Date(story.data.publishedAt).toISOString();
			const authors = await getEntries(story.data.authors);
			authorEntries.push(...authors);

			const authorTags = authors
				.map(
					(author) =>
						`<author><name>${escapeXml(author.data.name)}</name></author>`,
				)
				.join("\n\t\t");

			const categoryTags = (story.data.technologies ?? [])
				.map(
					(technology) =>
						`<category term="${escapeAttribute(technology)}"/>`,
				)
				.join("\n\t\t");

			return `	<entry>
		<title><![CDATA[${escapeCdata(story.data.title)}]]></title>
		<link href="${escapeAttribute(storyUrl)}" rel="alternate" type="text/html"/>
		<id>${escapeXml(storyUrl)}</id>
		<published>${published}</published>
		<updated>${published}</updated>
		<summary><![CDATA[${escapeCdata(story.data.description)}]]></summary>
		<content type="html"><![CDATA[${escapeCdata(escapeXml(story.data.description))}]]></content>
		${authorTags}
		${categoryTags}
	</entry>`;
		}),
	);

	const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
	<title>Rawkode Academy - News</title>
	<subtitle>Cloud native, Kubernetes, and AI infrastructure news for engineers.</subtitle>
	<link href="${escapeAttribute(feedUrl)}" rel="self" type="application/atom+xml"/>
	<link href="${escapeAttribute(`${site}/news`)}" rel="alternate" type="text/html"/>
	<id>${escapeXml(`${site}/news`)}</id>
	<updated>${lastUpdated}</updated>
	<author><name>${escapeXml(DEFAULT_FEED_AUTHOR)}</name></author>
	<generator>Astro</generator>
${entries.join("\n")}
</feed>`;

	await setContentCache(context, {
		entries: [...sortedNews, ...authorEntries],
		collections: ["news"],
	});

	return new Response(atomFeed, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}

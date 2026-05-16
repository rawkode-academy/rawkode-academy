export interface JsonFeedAuthor {
	name: string;
	url?: string;
	avatar?: string;
}

export interface JsonFeedItem {
	id: string;
	url: string;
	title: string;
	summary?: string;
	content_html?: string;
	content_text?: string;
	date_published: string;
	date_modified?: string;
	authors?: ReadonlyArray<JsonFeedAuthor>;
	tags?: ReadonlyArray<string>;
	image?: string;
	external_url?: string;
}

export interface BuildJsonFeedInput {
	title: string;
	description?: string;
	homePageUrl: string;
	feedUrl: string;
	icon?: string;
	favicon?: string;
	language?: string;
	items: ReadonlyArray<JsonFeedItem>;
}

/**
 * Build a JSON Feed 1.1 document. Spec: https://www.jsonfeed.org/version/1.1/
 *
 * JSON Feed is a modern alternative to RSS/Atom - same shape, much friendlier
 * to consume in JS clients, and supported by NetNewsWire, Feedbin, Inoreader,
 * FeedLand, and Reeder among others.
 */
export function buildJsonFeed(
	input: BuildJsonFeedInput,
): Record<string, unknown> {
	const {
		title,
		description,
		homePageUrl,
		feedUrl,
		icon,
		favicon,
		language = "en",
		items,
	} = input;

	const feed: Record<string, unknown> = {
		version: "https://jsonfeed.org/version/1.1",
		title,
		home_page_url: homePageUrl,
		feed_url: feedUrl,
		language,
	};

	if (description) feed.description = description;
	if (icon) feed.icon = icon;
	if (favicon) feed.favicon = favicon;

	feed.items = items.map((item) => {
		const out: Record<string, unknown> = {
			id: item.id,
			url: item.url,
			title: item.title,
			date_published: item.date_published,
		};
		if (item.summary) out.summary = item.summary;
		if (item.content_html) out.content_html = item.content_html;
		if (item.content_text) out.content_text = item.content_text;
		if (item.date_modified) out.date_modified = item.date_modified;
		if (item.authors && item.authors.length > 0) {
			out.authors = item.authors.map((author) => {
				const a: Record<string, string> = { name: author.name };
				if (author.url) a.url = author.url;
				if (author.avatar) a.avatar = author.avatar;
				return a;
			});
		}
		if (item.tags && item.tags.length > 0) {
			out.tags = [...item.tags];
		}
		if (item.image) out.image = item.image;
		if (item.external_url) out.external_url = item.external_url;
		return out;
	});

	return feed;
}

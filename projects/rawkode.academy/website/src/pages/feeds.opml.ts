import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { buildOpmlDocument, type OpmlFeed, type OpmlOutline } from "@/lib/opml";

const SITE_FALLBACK = "https://rawkode.academy";

const matchRef = (
	ref: { collection?: string; id?: string } | string | undefined,
	id: string,
): boolean => {
	if (!ref) return false;
	if (typeof ref === "string") return ref === id;
	return ref.id === id;
};

const personHasContribution = (
	personId: string,
	articles: Array<{ data: { authors: Array<unknown>; draft?: boolean } }>,
	news: Array<{ data: { authors: Array<unknown> } }>,
	videos: Array<{ data: { guests: Array<unknown> } }>,
): boolean => {
	if (
		articles.some(
			(article) =>
				!article.data.draft &&
				Array.isArray(article.data.authors) &&
				article.data.authors.some((author) =>
					matchRef(author as { id?: string } | string, personId),
				),
		)
	) {
		return true;
	}
	if (
		news.some(
			(story) =>
				Array.isArray(story.data.authors) &&
				story.data.authors.some((author) =>
					matchRef(author as { id?: string } | string, personId),
				),
		)
	) {
		return true;
	}
	return videos.some(
		(video) =>
			Array.isArray(video.data.guests) &&
			video.data.guests.some((guest) =>
				matchRef(guest as { id?: string } | string, personId),
			),
	);
};

export const GET: APIRoute = async ({ site }) => {
	const baseUrl = (site?.toString() ?? SITE_FALLBACK).replace(/\/$/, "");
	const u = (path: string) => `${baseUrl}${path}`;

	const [articles, news, videos, technologies, people, shows] =
		await Promise.all([
			getCollection("articles"),
			getCollection("news"),
			getCollection("videos"),
			getCollection("technologies"),
			getCollection("people"),
			getCollection("shows"),
		]);

	const topLevelFeeds: OpmlFeed[] = [
		{
			text: "Rawkode Academy — All Content",
			xmlUrl: u("/api/feeds/all.xml"),
			htmlUrl: u("/feeds"),
			description: "Articles, news, and videos in one feed.",
		},
		{
			text: "Rawkode Academy — Articles",
			xmlUrl: u("/api/feeds/articles.xml"),
			htmlUrl: u("/read"),
		},
		{
			text: "Rawkode Academy — News",
			xmlUrl: u("/api/feeds/news.xml"),
			htmlUrl: u("/news"),
		},
		{
			text: "Rawkode Academy — Videos",
			xmlUrl: u("/api/feeds/videos.xml"),
			htmlUrl: u("/watch"),
		},
	];

	const technologyOutlines: OpmlFeed[] = [...technologies]
		.map((technology) => ({
			rawId: technology.id.replace(/\/index$/, ""),
			name: technology.data.name,
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(({ rawId, name }) => ({
			text: `Rawkode Academy — ${name}`,
			xmlUrl: u(`/api/feeds/technology/${rawId}.xml`),
			htmlUrl: u(`/technology/${rawId}`),
		}));

	const peopleOutlines: OpmlFeed[] = people
		.filter((person) =>
			personHasContribution(
				person.data.id,
				articles as never,
				news as never,
				videos as never,
			),
		)
		.map((person) => ({ id: person.data.id, name: person.data.name }))
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(({ id, name }) => ({
			text: `Rawkode Academy — ${name}`,
			xmlUrl: u(`/api/feeds/people/${id}.xml`),
			htmlUrl: u(`/people/${id}`),
		}));

	const publishedShows = shows.filter((show) => show.data.publish);
	const showOutlines: OpmlFeed[] = publishedShows
		.map((show) => ({ id: show.data.id, name: show.data.name }))
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(({ id, name }) => ({
			text: `Rawkode Academy — ${name} (podcast)`,
			xmlUrl: u(`/api/feeds/shows/${id}.xml`),
			htmlUrl: u(`/shows/${id}`),
		}));

	const groups: OpmlOutline[] = [
		{ text: "Podcasts", children: showOutlines },
		{ text: "Technologies", children: technologyOutlines },
		{ text: "Contributors", children: peopleOutlines },
	];

	const opml = buildOpmlDocument({
		title: "Rawkode Academy feeds",
		ownerName: "Rawkode Academy",
		topLevelFeeds,
		groups,
	});

	return new Response(opml, {
		headers: {
			"Content-Type": "text/x-opml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

export const prerender = true;

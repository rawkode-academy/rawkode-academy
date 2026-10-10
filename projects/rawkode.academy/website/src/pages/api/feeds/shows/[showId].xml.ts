import { getEntry, getEntries, getAllCollection } from "@/lib/payload-content";
import type { APIContext } from "astro";
import { generateRssFeed } from "feedsmith";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";

/**
 * Generate a squared podcast artwork URL using Cloudflare Image Resizing.
 * Apple Podcasts requires square artwork (1400x1400 to 3000x3000 pixels).
 */
function getSquaredArtworkUrl(site: string, originalUrl: string): string {
	// Use Cloudflare Image Resizing to crop to square
	// fit=cover crops the image to fill the dimensions
	const params = "width=1400,height=1400,fit=cover,format=jpeg,quality=90";
	return `${site}/cdn-cgi/image/${params}/${originalUrl}`;
}

export const prerender = false;

export async function GET(context: APIContext) {
	const showSlug = context.params.showId ?? "";
	const site = (context.site?.toString() || "https://rawkode.academy").replace(
		/\/$/,
		"",
	);

	const show = showSlug ? await getEntry("shows", { slug: showSlug }) : undefined;

	if (!show || show.data.status === "coming-soon") {
		return new Response("Show feed not found", { status: 404 });
	}

	const showVideos = (await getAllCollection(
		"videos",
		({ data }) => data.publishedAt <= new Date(),
		{ showId: show.id },
	))
		.sort(
			(a, b) =>
				new Date(b.data.publishedAt).getTime() -
				new Date(a.data.publishedAt).getTime(),
		);

	const hostEntries = await getEntries(show.data.hosts);

	const podcastConfig = show.data.podcast;
	const showDescription =
		show.data.description || `Episodes from ${show.data.name}`;
	const feedUrl = `${site}/api/feeds/shows/${show.slug}.xml`;
	const showLink = `${site}/shows/${show.slug}`;

	const firstVideo = showVideos[0];
	const lastBuildDate = firstVideo
		? new Date(firstVideo.data.publishedAt)
		: new Date();

	// Use podcast.artworkUrl if available, otherwise fall back to thumbnail
	// Apply square cropping for Apple Podcasts requirements
	const originalShowImageUrl = podcastConfig?.artworkUrl
		? podcastConfig.artworkUrl
		: firstVideo
			? getVideoThumbnailUrl(firstVideo.data.id)
			: "";
	const showImageUrl = originalShowImageUrl
		? getSquaredArtworkUrl(site, originalShowImageUrl)
		: "";

	// Build items
	const items = await Promise.all(
		showVideos.map(async (video, index) => {
			const episodeNumber = showVideos.length - index;
			const duration =
				typeof video.data.duration === "number" ? video.data.duration : 0;
			const audioUrl = `https://content.rawkode.academy/videos/${video.data.id}/original.mp3`;
			const originalThumbnailUrl = getVideoThumbnailUrl(video.data.id);
		const episodeUrl = `${site}/watch/${video.slug}/`;
			const audioFileSize = video.data.audioFileSize || 0;
			const chaptersUrl = `${site}/api/feeds/shows/${show.slug}/${video.slug}/chapters.json`;

			// Generate squared thumbnail URL using Cloudflare Image Resizing
			const thumbnailUrl = getSquaredArtworkUrl(site, originalThumbnailUrl);

			// Fetch guest data for podcast:person tags
			const guestEntries = video.data.guests?.length
				? await getEntries(video.data.guests)
				: [];

			const guestPersons = guestEntries.map((guest) => ({
				display: guest.data.name,
				role: "guest",
				img: guest.data.avatarUrl,
				href:
					guest.data.website ||
					guest.data.twitter ||
					`https://rawkode.academy/people/${guest.slug}`,
			}));

			const hostPersons = hostEntries.map((host) => ({
				display: host.data.name,
				role: "host",
				img: host.data.avatarUrl,
				href:
					host.data.website ||
					host.data.twitter ||
					`https://rawkode.academy/people/${host.slug}`,
			}));

			const hasChapters = video.data.chapters && video.data.chapters.length > 0;

			return {
				title: video.data.title,
				link: episodeUrl,
				description: video.data.description,
				guid: {
					value: video.data.id,
					isPermaLink: false,
				},
				pubDate: new Date(video.data.publishedAt),
				enclosures: [
					{
						url: audioUrl,
						type: "audio/mpeg",
						length: audioFileSize,
					},
				],
				itunes: {
					title: video.data.title,
					duration: duration,
					image: thumbnailUrl,
					explicit: podcastConfig?.explicit ?? false,
					author: "Rawkode Academy",
					episode: episodeNumber,
					episodeType: "full",
				},
				podcast: {
					persons: [...hostPersons, ...guestPersons],
					...(hasChapters && {
						chapters: {
							url: chaptersUrl,
							type: "application/json+chapters",
						},
					}),
				},
			};
		}),
	);

	// Build iTunes categories
	const itunesCategories = podcastConfig?.category
		? [
				{
					text: podcastConfig.category,
					...(podcastConfig.subcategory && {
						categories: [{ text: podcastConfig.subcategory }],
					}),
				},
			]
		: undefined;

	// biome-ignore lint/suspicious/noExplicitAny: feedsmith types are overly strict with exactOptionalPropertyTypes
	const feed: any = {
		title: show.data.name,
		link: showLink,
		description: showDescription,
		language: "en-us",
		lastBuildDate: lastBuildDate,
		copyright: podcastConfig?.copyright,
		generator: "Rawkode Academy",
		// Standard RSS image element
		...(showImageUrl && {
			image: {
				url: showImageUrl,
				title: show.data.name,
				link: showLink,
			},
		}),
		items: items,
		atom: {
			links: [
				{
					href: feedUrl,
					rel: "self",
					type: "application/rss+xml",
				},
			],
		},
		itunes: {
			author: "Rawkode Academy",
			explicit: podcastConfig?.explicit ?? false,
			type: "episodic",
			image: showImageUrl || undefined,
			categories: itunesCategories,
			...(podcastConfig?.email && {
				owner: {
					name: "Rawkode Academy",
					email: podcastConfig.email,
				},
			}),
		},
		podcast: {
			locked: {
				value: false,
			},
			medium: "podcast",
			// Podcast GUID for feed identity
			...(podcastConfig?.guid && {
				guid: podcastConfig.guid,
			}),
			// Channel-level hosts
			persons: hostEntries.map((host) => ({
				display: host.data.name,
				role: "host",
				img: host.data.avatarUrl,
				href: host.data.website || host.data.twitter,
			})),
		},
	};

	const rss = generateRssFeed(feed);

	return new Response(rss, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
}

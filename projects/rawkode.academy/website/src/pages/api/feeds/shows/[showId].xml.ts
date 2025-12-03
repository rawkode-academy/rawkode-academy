import { getCollection, getEntries } from "astro:content";
import type { APIContext } from "astro";
import { generateRssFeed } from "feedsmith";

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

export async function getStaticPaths() {
	const shows = await getCollection("shows");
	return shows
		.filter((show) => show.data.publish)
		.map((show) => ({ params: { showId: show.data.id } }));
}

export async function GET(context: APIContext) {
	const { showId } = context.params;
	const site = (context.site?.toString() || "https://rawkode.academy").replace(
		/\/$/,
		"",
	);

	const shows = await getCollection("shows");
	const show = shows.find((s) => s.data.id === showId);

	if (!show || !show.data.publish) {
		return new Response("Show not found or not published", { status: 404 });
	}

	const videos = await getCollection("videos");
	const showVideos = videos
		.filter((video) => {
			const videoShow = video.data.show;
			if (!videoShow) return false;
			const showRef = typeof videoShow === "string" ? videoShow : videoShow.id;
			return showRef === showId;
		})
		.sort(
			(a, b) =>
				new Date(b.data.publishedAt).getTime() -
				new Date(a.data.publishedAt).getTime(),
		);

	const hostEntries = await getEntries(show.data.hosts);

	const podcastConfig = show.data.podcast;
	const showDescription =
		show.data.description || `Episodes from ${show.data.name}`;
	const feedUrl = `${site}/api/feeds/shows/${showId}.xml`;
	const showLink = `${site}/shows/${showId}`;

	const firstVideo = showVideos[0];
	const lastBuildDate = firstVideo
		? new Date(firstVideo.data.publishedAt)
		: new Date();

	// Use podcast.artworkUrl if available, otherwise fall back to thumbnail
	// Apply square cropping for Apple Podcasts requirements
	const originalShowImageUrl = podcastConfig?.artworkUrl
		? podcastConfig.artworkUrl
		: firstVideo
			? `https://content.rawkode.academy/videos/${firstVideo.data.videoId}/thumbnail.jpg`
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
			const audioUrl = `https://content.rawkode.academy/videos/${video.data.videoId}/original.mp3`;
			const originalThumbnailUrl = `https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`;
			const episodeUrl = `${site}/watch/${video.data.slug}/`;
			const audioFileSize = video.data.audioFileSize || 0;
			const chaptersUrl = `${site}/api/feeds/shows/${showId}/${video.data.slug}/chapters.json`;

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
					`https://rawkode.academy/people/${guest.data.id}`,
			}));

			const hostPersons = hostEntries.map((host) => ({
				display: host.data.name,
				role: "host",
				img: host.data.avatarUrl,
				href:
					host.data.website ||
					host.data.twitter ||
					`https://rawkode.academy/people/${host.data.id}`,
			}));

			const hasChapters = video.data.chapters && video.data.chapters.length > 0;

			return {
				title: video.data.title,
				link: episodeUrl,
				description: video.data.description,
				guid: {
					value: video.data.videoId,
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
			"Cache-Control": "max-age=3600",
		},
	});
}

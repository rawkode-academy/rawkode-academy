export interface VideoListEntry {
	id: string;
	slug: string;
	title: string;
	description: string;
	publishedAt: Date;
	duration?: number; // seconds
}

export interface BuildVideoItemListJsonLdInput {
	siteUrl: string;
	listUrl: string;
	listName: string;
	videos: ReadonlyArray<VideoListEntry>;
	thumbnailBaseUrl?: string;
	videoBaseUrl?: string;
	limit?: number;
}

const DEFAULT_LIMIT = 20;
const DEFAULT_THUMBNAIL_BASE = "https://content.rawkode.academy/videos";
const DEFAULT_VIDEO_BASE = "https://content.rawkode.academy/videos";
const PUBLISHER_NAME = "Rawkode Academy";

function joinUrl(base: string, path: string): string {
	return new URL(path, base).href;
}

/**
 * Format a duration in seconds as an ISO 8601 duration, the shape Google's
 * VideoObject rich result expects. 90 -> "PT1M30S", 3661 -> "PT1H1M1S".
 * Undefined / non-positive / non-finite inputs return undefined so the
 * caller can omit the field rather than emit "PT0S".
 */
export function secondsToIsoVideoDuration(
	seconds: number | undefined,
): string | undefined {
	if (
		typeof seconds !== "number" ||
		!Number.isFinite(seconds) ||
		seconds <= 0
	) {
		return undefined;
	}
	const total = Math.floor(seconds);
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const remainingSeconds = total % 60;
	let result = "PT";
	if (hours > 0) result += `${hours}H`;
	if (minutes > 0) result += `${minutes}M`;
	if (remainingSeconds > 0 || result === "PT") {
		result += `${remainingSeconds}S`;
	}
	return result;
}

/**
 * Build a schema.org ItemList JSON-LD payload for the /watch videos index.
 *
 * Each ListItem embeds a lightweight VideoObject - the shape Google requires
 * for the video Carousel rich result on list-type pages (see
 * https://developers.google.com/search/docs/appearance/structured-data/carousel).
 */
export function buildVideoItemListJsonLd(
	input: BuildVideoItemListJsonLdInput,
): Record<string, unknown> {
	const {
		siteUrl,
		listUrl,
		listName,
		videos,
		thumbnailBaseUrl = DEFAULT_THUMBNAIL_BASE,
		videoBaseUrl = DEFAULT_VIDEO_BASE,
		limit = DEFAULT_LIMIT,
	} = input;

	const ordered = [...videos]
		.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
		.slice(0, Math.max(0, limit));

	const itemListElement = ordered.map((video, index) => {
		const videoUrl = joinUrl(siteUrl, `/watch/${video.slug}`);
		const thumbnailUrl = `${thumbnailBaseUrl}/${video.id}/thumbnail.webp`;
		const contentUrl = `${videoBaseUrl}/${video.id}/stream.m3u8`;
		const uploadDate = new Date(video.publishedAt).toISOString();
		const isoDuration = secondsToIsoVideoDuration(video.duration);
		const item: Record<string, unknown> = {
			"@type": "VideoObject",
			name: video.title,
			description: video.description,
			thumbnailUrl,
			uploadDate,
			contentUrl,
			url: videoUrl,
			mainEntityOfPage: { "@type": "WebPage", "@id": videoUrl },
			publisher: {
				"@type": "Organization",
				name: PUBLISHER_NAME,
				url: siteUrl,
			},
		};
		if (isoDuration) {
			item.duration = isoDuration;
		}
		return {
			"@type": "ListItem",
			position: index + 1,
			url: videoUrl,
			item,
		};
	});

	return {
		"@context": "https://schema.org",
		"@type": "ItemList",
		name: listName,
		url: listUrl,
		numberOfItems: itemListElement.length,
		itemListOrder: "https://schema.org/ItemListOrderDescending",
		itemListElement,
	};
}

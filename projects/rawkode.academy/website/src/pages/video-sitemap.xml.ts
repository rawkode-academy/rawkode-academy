import type { APIRoute } from "astro";
import { getPublishedVideos, hasTranscodedVodAssets } from "@/lib/content";
import { getCollection, setContentCache } from "@/lib/live-content";
import { plainTextDescription } from "@/lib/plain-text-description";
import { toAbsoluteUrl } from "@/lib/sitemaps";
import { getVideoThumbnailUrl } from "@/lib/video-thumbnail";
import { normalizeTechnologyReferences } from "@/utils/normalize-technology-refs";

export const prerender = false;

const DEFAULT_SITE_URL = "https://rawkode.academy";
const MAX_VIDEO_DURATION_SECONDS = 28_800;
const MAX_VIDEO_DESCRIPTION_LENGTH = 2048;

export function toVideoDurationValue(duration: unknown): string | undefined {
	if (typeof duration !== "number" || !Number.isFinite(duration)) {
		return undefined;
	}

	const seconds = Math.floor(duration);
	if (seconds < 1 || seconds > MAX_VIDEO_DURATION_SECONDS) {
		return undefined;
	}

	return String(seconds);
}

// Escape XML entities
function escapeXml(value: unknown): string {
	const unsafe =
		typeof value === "string" ? value : value == null ? "" : String(value);
	return unsafe.replace(/[<>&'"]/g, (c) => {
		switch (c) {
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
				return c;
		}
	});
}

export const GET: APIRoute = async (context) => {
	const now = new Date();
	const [videos, technologies] = await Promise.all([
		getPublishedVideos(),
		getCollection("technologies"),
	]);
	await setContentCache(context, {
		collections: ["videos", "technologies"],
	});
	const siteUrl = context.site ?? new URL(DEFAULT_SITE_URL);
	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);

	// Sort videos by publishedAt date (newest first)
	const sortedVideos = [...videos].sort((a, b) => {
		const dateA = new Date(a.data.publishedAt);
		const dateB = new Date(b.data.publishedAt);
		return dateB.getTime() - dateA.getTime();
	});

	const urlEntries = sortedVideos
		.map((video) => {
			const publishedDateObj = new Date(video.data.publishedAt);
			if (Number.isNaN(publishedDateObj.getTime())) {
				return null;
			}

			const isVodReady = hasTranscodedVodAssets(video, now);
			const youtubeId =
				typeof video.data.youtubeId === "string"
					? video.data.youtubeId.trim()
					: "";

			let mediaLocLine: string;
			if (isVodReady) {
				const contentUrl = `https://content.rawkode.academy/videos/${video.data.id}/stream.m3u8`;
				mediaLocLine = `      <video:content_loc>${escapeXml(contentUrl)}</video:content_loc>`;
			} else if (youtubeId.length > 0) {
				const playerUrl = `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}`;
				mediaLocLine = `      <video:player_loc>${escapeXml(playerUrl)}</video:player_loc>`;
			} else {
				return null;
			}

			const videoUrl = toAbsoluteUrl(siteUrl, `/watch/${video.data.slug}`);
			const thumbnailUrl = getVideoThumbnailUrl(video.data.id);
			const duration = isVodReady
				? toVideoDurationValue(video.data.duration)
				: undefined;
			const publishedDate = publishedDateObj.toISOString();
			const recordUpdatedAt = video.data.recordUpdatedAt
				? new Date(video.data.recordUpdatedAt)
				: undefined;
			const lastModified =
				recordUpdatedAt &&
				!Number.isNaN(recordUpdatedAt.getTime()) &&
				recordUpdatedAt.getTime() > publishedDateObj.getTime()
					? recordUpdatedAt.toISOString()
					: publishedDate;

			// Create tags from technologies
			const tags = normalizeTechnologyReferences(video.data.technologies)
				.map((id) => techName.get(id) ?? id)
				.filter((tag) => tag.length > 0)
				.slice(0, 32);

			const optionalLines: string[] = [];
			if (duration) {
				optionalLines.push(`      <video:duration>${duration}</video:duration>`);
			}
			const tagLines = tags.map(
				(tag) => `      <video:tag>${escapeXml(tag)}</video:tag>`,
			);

			const videoLines = [
				`      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>`,
				`      <video:title>${escapeXml(video.data.title)}</video:title>`,
				`      <video:description>${escapeXml(
					plainTextDescription(
						video.data.description,
						MAX_VIDEO_DESCRIPTION_LENGTH,
					),
				)}</video:description>`,
				mediaLocLine,
				...optionalLines,
				`      <video:publication_date>${publishedDate}</video:publication_date>`,
				`      <video:family_friendly>yes</video:family_friendly>`,
				`      <video:live>no</video:live>`,
				`      <video:requires_subscription>no</video:requires_subscription>`,
				`      <video:uploader info="${escapeXml(siteUrl.href)}">Rawkode Academy</video:uploader>`,
				...tagLines,
			];

			return `  <url>
    <loc>${escapeXml(videoUrl)}</loc>
    <lastmod>${lastModified}</lastmod>
    <video:video>
${videoLines.join("\n")}
    </video:video>
  </url>`;
		})
		.filter((entry): entry is string => entry !== null)
		.join("\n");

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urlEntries}
</urlset>`;

	return new Response(sitemap.trim(), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
		},
	});
};

import { getCollection } from "astro:content";
import type { APIRoute } from "astro";

// Format duration from seconds to ISO 8601
function formatDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	let result = "PT";
	if (hours > 0) {
		result += `${hours}H`;
	}
	if (minutes > 0) {
		result += `${minutes}M`;
	}
	if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) {
		result += `${remainingSeconds}S`;
	}
	return result;
}

// Escape XML entities
function escapeXml(unsafe: string): string {
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

export const GET: APIRoute = async ({ site }) => {
	const videos = await getCollection("videos");
	const technologies = await getCollection("technologies");
	const techName = new Map(technologies.map((t) => [t.id, t.data.name] as const));

	// Sort videos by publishedAt date (newest first)
	const sortedVideos = videos.sort((a, b) => {
		const dateA = new Date(a.data.publishedAt);
		const dateB = new Date(b.data.publishedAt);
		return dateB.getTime() - dateA.getTime();
	});

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${sortedVideos
	.map((video) => {
		const videoUrl = `${site}watch/${video.data.slug}/`;
		const thumbnailUrl = `https://content.rawkode.academy/videos/${video.data.videoId}/thumbnail.jpg`;
		const contentUrl = `https://content.rawkode.academy/videos/${video.data.videoId}/stream.m3u8`;
		const durationSeconds =
			typeof video.data.duration === "number"
				? video.data.duration
				: 0;
		const duration = formatDuration(durationSeconds);
		const publishedDate = new Date(video.data.publishedAt).toISOString();

		// Create tags from technologies
		const tags = (video.data.technologies || [])
			.map((id) => techName.get(id) || id)
			.slice(0, 32)
			.join(", ");

		return `  <url>
    <loc>${videoUrl}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${escapeXml(video.data.title)}</video:title>
      <video:description>${escapeXml(
				video.data.description,
			)}</video:description>
      <video:content_loc>${escapeXml(contentUrl)}</video:content_loc>
      <video:player_loc>${escapeXml(contentUrl)}</video:player_loc>
      <video:duration>${duration}</video:duration>
      <video:publication_date>${publishedDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
      <video:requires_subscription>no</video:requires_subscription>
      <video:uploader info="${site}">Rawkode Academy</video:uploader>
      ${tags ? `<video:tag>${escapeXml(tags)}</video:tag>` : ""}
    </video:video>
  </url>`;
	})
	.join("\n")}
</urlset>`;

	return new Response(sitemap.trim(), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600", // Cache for 1 hour
		},
	});
};

// Prerender at build time
export const prerender = true;

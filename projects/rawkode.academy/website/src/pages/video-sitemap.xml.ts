import { getCollection } from "astro:content";
import type { APIRoute } from "astro";
import { getPublishedVideos } from "@/lib/content";

const DEFAULT_SITE_URL = "https://rawkode.academy";
const MAX_VIDEO_DURATION_SECONDS = 28_800;

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

export const GET: APIRoute = async ({ site }) => {
	const videos = await getPublishedVideos();
	const technologies = await getCollection("technologies");
	const siteUrl = site ?? new URL(DEFAULT_SITE_URL);
	const techName = new Map(
		technologies.map((t) => [t.id, t.data.name] as const),
	);

	// Sort videos by publishedAt date (newest first)
	const sortedVideos = [...videos].sort((a, b) => {
		const dateA = new Date(a.data.publishedAt);
		const dateB = new Date(b.data.publishedAt);
		return dateB.getTime() - dateA.getTime();
	});

	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${sortedVideos
	.map((video) => {
		const videoUrl = new URL(`/watch/${video.data.slug}`, siteUrl).href;
		const thumbnailUrl = `https://content.rawkode.academy/videos/${video.data.id}/thumbnail.jpg`;
		const contentUrl = `https://content.rawkode.academy/videos/${video.data.id}/stream.m3u8`;
		const duration = toVideoDurationValue(video.data.duration);
		const publishedDate = new Date(video.data.publishedAt).toISOString();

		// Create tags from technologies
		const tags = (video.data.technologies || [])
			.map((id) => {
				if (typeof id !== "string") return undefined;
				return techName.get(id) ?? id.replace(/\/index$/, "");
			})
			.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
			.slice(0, 32);

		const tagsXml = tags.length
			? tags
					.map((tag) => `<video:tag>${escapeXml(tag)}</video:tag>`)
					.join("\n      ")
			: "";
		const durationXml = duration
			? `\n      <video:duration>${duration}</video:duration>`
			: "";

		return `  <url>
    <loc>${videoUrl}</loc>
    <lastmod>${publishedDate}</lastmod>
    <changefreq>daily</changefreq>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${escapeXml(video.data.title)}</video:title>
      <video:description>${escapeXml(
				video.data.description,
			)}</video:description>
      <video:content_loc>${escapeXml(contentUrl)}</video:content_loc>
      ${durationXml}
      <video:publication_date>${publishedDate}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
      <video:requires_subscription>no</video:requires_subscription>
      <video:uploader info="${siteUrl.href}">Rawkode Academy</video:uploader>
      ${tagsXml}
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

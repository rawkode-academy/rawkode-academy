import type { APIContext } from "astro";
import { getPublishedVideos } from "@/lib/content";
import { buildWatchVideoSeoText } from "@/utils/watch-video-seo";

export const prerender = false;

const DEFAULT_SITE_URL = "https://rawkode.academy";

function formatTimestamp(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	return h > 0
		? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
		: `${m}:${String(s).padStart(2, "0")}`;
}

export async function GET({ params, site }: APIContext) {
	const videos = await getPublishedVideos();
	const video = videos.find((v) => v.data.slug === params.slug);

	if (!video) {
		return new Response(null, { status: 404 });
	}

	const canonicalUrl = new URL(
		`/watch/${video.data.slug}`,
		site ?? DEFAULT_SITE_URL,
	).href;
	const captionUrl = `https://content.rawkode.academy/videos/${video.data.id}/captions/en.vtt`;
	const description = video.data.description.replace(/\\n/g, "\n").trim();

	type Chapter = { startTime: number; title: string };
	const chapters: Chapter[] = Array.isArray(video.data.chapters)
		? (video.data.chapters as Chapter[]).map((chapter) => ({
				title: chapter.title,
				startTime: Math.max(0, Math.floor(chapter?.startTime ?? 0)),
			}))
		: [];

	const seoText = await buildWatchVideoSeoText({
		captionUrl,
		description,
		chapters,
	});

	const lines: string[] = [
		`# ${video.data.title}`,
		"",
		`- Canonical: ${canonicalUrl}`,
		`- Published: ${new Date(video.data.publishedAt).toISOString().slice(0, 10)}`,
	];

	if (typeof video.data.duration === "number" && video.data.duration > 0) {
		lines.push(`- Duration: ${formatTimestamp(video.data.duration)}`);
	}

	lines.push("", "## Description", "", description);

	if (chapters.length > 0) {
		lines.push("", "## Chapters", "");
		for (const chapter of chapters) {
			lines.push(`- ${formatTimestamp(chapter.startTime)} ${chapter.title}`);
		}
	}

	const transcriptParagraphs = seoText.transcriptParagraphs ?? [];
	if (transcriptParagraphs.length > 0) {
		lines.push("", "## Transcript", "");
		for (const paragraph of transcriptParagraphs) {
			lines.push(
				`[${formatTimestamp(paragraph.startSeconds)}] ${paragraph.text}`,
				"",
			);
		}
	}

	lines.push("");

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Cache-Control":
				"public, max-age=600, s-maxage=7200, stale-while-revalidate=172800",
			"CDN-Cache-Control": "public, max-age=7200",
			"Cache-Tag": `video-${video.data.slug}, video-markdown`,
		},
	});
}

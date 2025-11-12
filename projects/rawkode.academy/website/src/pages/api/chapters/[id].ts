import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

// Define types for the GraphQL response
interface Chapter {
	startTime: number;
	title: string;
}

export const prerender = false;

// Function to format time in HH:MM:SS.mmm format for VTT
function formatVttTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = Math.floor(seconds % 60);
	const milliseconds = Math.floor((seconds % 1) * 1000);

	return `${hours.toString().padStart(2, "0")}:${minutes
		.toString()
		.padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${milliseconds
		.toString()
		.padStart(3, "0")}`;
}

// Generate VTT content from chapters
function normalizeChapters(
	chapters?: Array<{ startTime?: number | null; title?: string | null }> | null,
): Chapter[] {
	return (chapters ?? [])
		.map((chapter) => ({
			title: (chapter?.title ?? "").trim(),
			startTime: Math.max(0, Math.floor(chapter?.startTime ?? 0)),
		}))
		.filter((chapter) => chapter.title.length > 0);
}

function generateVttContent(videoTitle: string, chapters: Chapter[]): string {
	if (!chapters || chapters.length === 0) {
		return "WEBVTT\n\n";
	}

	let vttContent = "WEBVTT\n\n";

	// Add video title as a comment
	vttContent += `NOTE\nVideo: ${videoTitle}\n\n`;

	// Process each chapter
	for (let i = 0; i < chapters.length; i++) {
		const chapter = chapters[i];
		if (!chapter) continue;

		const startTime = formatVttTime(chapter.startTime);

		// For the end time, use the start time of the next chapter or a large value for the last chapter
		const nextChapter = i < chapters.length - 1 ? chapters[i + 1] : null;
		const endTime = nextChapter
			? formatVttTime(nextChapter.startTime)
			: "99:59:59.999";

		vttContent += `${i + 1}\n`;
		vttContent += `${startTime} --> ${endTime}\n`;
		vttContent += `${chapter.title}\n\n`;
	}

	return vttContent;
}

export const GET: APIRoute = async ({ params }): Promise<Response> => {
	try {
		const videoId = params.id;

		if (!videoId) {
			return new Response("Video ID is required", { status: 400 });
		}

		const videos = await getCollection("videos");
		const localVideo = videos.find((entry) => entry.data.videoId === videoId);
		if (!localVideo) {
			return new Response("Video not found", { status: 404 });
		}

		const title = localVideo.data.title ?? videoId;
		const chapters = normalizeChapters(localVideo.data.chapters as Chapter[]);

		const vttContent = generateVttContent(title, chapters);

		// Return VTT file with appropriate headers
		return new Response(vttContent, {
			headers: {
				"Content-Type": "text/vtt",
				"Content-Disposition": `attachment; filename="${videoId}-chapters.vtt"`,
				"Cache-Control": "public, max-age=3600",
			},
		});
	} catch (error) {
		console.error("Error generating chapters VTT:", error);
		return new Response("Error generating chapters VTT", { status: 500 });
	}
};

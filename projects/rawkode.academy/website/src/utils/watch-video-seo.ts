import {
	buildTranscriptExcerpt,
	groupTranscriptParagraphs,
	parseWebVTT,
	transcriptParagraphToText,
} from "@/utils/video-transcript";

export type WatchVideoSeoTextSource = "transcript" | "summary" | "none";

export interface WatchVideoSeoTextState {
	textSource: WatchVideoSeoTextSource;
	previewHeading: string;
	previewDescription: string;
	previewParagraphs: string[];
	transcriptExcerpt?: string;
}

type ChapterLike = {
	title?: string;
	startTime?: number;
};

interface BuildWatchVideoSeoTextOptions {
	captionUrl: string;
	description: string;
	chapters?: ChapterLike[];
	fetchImpl?: typeof fetch;
	timeoutMs?: number;
}

const TRANSCRIPT_PREVIEW_HEADING = "Transcript Preview";
const TRANSCRIPT_PREVIEW_DESCRIPTION =
	"Server-rendered from the English captions file so the spoken content is present in the initial HTML.";
const SUMMARY_PREVIEW_HEADING = "Video Summary";
const SUMMARY_PREVIEW_DESCRIPTION =
	"Server-rendered from the description and chapter titles so the page keeps indexable explanatory text even when captions are unavailable.";
const DEFAULT_CAPTION_FETCH_TIMEOUT_MS = 2_000;

function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

function normalizeDescription(description: string): string {
	return description.replace(/\\n/g, "\n").trim();
}

export function buildVideoSummaryParagraphs(
	description: string,
	chapters: readonly ChapterLike[] = [],
	maxParagraphs = 2,
): string[] {
	const normalizedDescription = normalizeDescription(description);
	const descriptionParagraphs = normalizedDescription
		.split(/\n{2,}/)
		.map((paragraph) => normalizeWhitespace(paragraph))
		.filter((paragraph) => paragraph.length > 0);

	const summaryParagraphs = descriptionParagraphs.slice(0, maxParagraphs);

	if (summaryParagraphs.length >= maxParagraphs) {
		return summaryParagraphs;
	}

	const chapterTitles = chapters
		.map((chapter) =>
			typeof chapter.title === "string" ? normalizeWhitespace(chapter.title) : "",
		)
		.filter((title) => title.length > 0)
		.slice(0, 6);

	if (chapterTitles.length > 0) {
		summaryParagraphs.push(`Key moments: ${chapterTitles.join("; ")}.`);
	}

	return summaryParagraphs.slice(0, maxParagraphs);
}

function buildSummaryState(
	description: string,
	chapters: readonly ChapterLike[],
): WatchVideoSeoTextState {
	const previewParagraphs = buildVideoSummaryParagraphs(description, chapters);
	if (previewParagraphs.length > 0) {
		return {
			textSource: "summary",
			previewHeading: SUMMARY_PREVIEW_HEADING,
			previewDescription: SUMMARY_PREVIEW_DESCRIPTION,
			previewParagraphs,
		};
	}

	return {
		textSource: "none",
		previewHeading: "",
		previewDescription: "",
		previewParagraphs: [],
	};
}

export async function buildWatchVideoSeoText({
	captionUrl,
	description,
	chapters = [],
	fetchImpl = fetch,
	timeoutMs = DEFAULT_CAPTION_FETCH_TIMEOUT_MS,
}: BuildWatchVideoSeoTextOptions): Promise<WatchVideoSeoTextState> {
	const abortController = new AbortController();
	const timeoutId = setTimeout(() => {
		abortController.abort();
	}, timeoutMs);

	try {
		const transcriptResponse = await fetchImpl(captionUrl, {
			headers: {
				Accept: "text/vtt,text/plain;q=0.9,*/*;q=0.1",
			},
			signal: abortController.signal,
		});

		if (transcriptResponse.ok) {
			const transcriptVtt = await transcriptResponse.text();
			const transcriptCues = parseWebVTT(transcriptVtt);
			const transcriptParagraphs = groupTranscriptParagraphs(transcriptCues);
			const previewParagraphs = transcriptParagraphs
				.slice(0, 2)
				.map((paragraph) => transcriptParagraphToText(paragraph))
				.filter((paragraph) => paragraph.length > 0);

			if (previewParagraphs.length > 0) {
				return {
					textSource: "transcript",
					previewHeading: TRANSCRIPT_PREVIEW_HEADING,
					previewDescription: TRANSCRIPT_PREVIEW_DESCRIPTION,
					previewParagraphs,
					transcriptExcerpt: buildTranscriptExcerpt(transcriptParagraphs),
				};
			}
		}
	} catch {
		// Fall back to a server-rendered summary when captions are unavailable.
	} finally {
		clearTimeout(timeoutId);
	}

	return buildSummaryState(description, chapters);
}

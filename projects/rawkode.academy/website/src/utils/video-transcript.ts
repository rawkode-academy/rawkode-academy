export interface TranscriptCue {
	start: string;
	end: string;
	text: string;
}

export type TranscriptParagraph = TranscriptCue[];

const TIMESTAMP_PATTERN =
	/^(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/;

function normalizeCueText(text: string): string {
	return text
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function parseWebVTT(vttText: string): TranscriptCue[] {
	const lines = vttText.split(/\r?\n/);
	const cues: TranscriptCue[] = [];
	let currentCue: TranscriptCue | null = null;

	for (const rawLine of lines) {
		const line = rawLine.trim();

		if (!line || line === "WEBVTT" || /^\d+$/.test(line)) {
			continue;
		}

		if (line.startsWith("NOTE")) {
			currentCue = null;
			continue;
		}

		const timestampMatch = line.match(TIMESTAMP_PATTERN);
		if (timestampMatch) {
			const start = timestampMatch[1];
			const end = timestampMatch[2];
			if (!start || !end) {
				continue;
			}

			if (currentCue?.text.trim()) {
				cues.push(currentCue);
			}

			currentCue = {
				start,
				end,
				text: "",
			};
			continue;
		}

		if (!currentCue) {
			continue;
		}

		const normalizedText = normalizeCueText(line);
		if (!normalizedText) {
			continue;
		}

		currentCue.text = currentCue.text
			? `${currentCue.text} ${normalizedText}`
			: normalizedText;
	}

	if (currentCue?.text.trim()) {
		cues.push(currentCue);
	}

	return cues;
}

export function groupTranscriptParagraphs(
	cues: TranscriptCue[],
	maxWordsPerParagraph = 100,
): TranscriptParagraph[] {
	const paragraphs: TranscriptParagraph[] = [];
	let currentParagraph: TranscriptParagraph = [];
	let wordCount = 0;

	for (const cue of cues) {
		currentParagraph.push(cue);
		wordCount += cue.text.split(/\s+/).filter(Boolean).length;

		if (wordCount >= maxWordsPerParagraph) {
			paragraphs.push(currentParagraph);
			currentParagraph = [];
			wordCount = 0;
		}
	}

	if (currentParagraph.length > 0) {
		paragraphs.push(currentParagraph);
	}

	return paragraphs;
}

export function transcriptParagraphToText(
	paragraph: TranscriptParagraph,
): string {
	return paragraph
		.map((cue) => cue.text)
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
}

export function buildTranscriptExcerpt(
	paragraphs: TranscriptParagraph[],
	maxChars = 1600,
): string {
	const excerptParts: string[] = [];
	let length = 0;

	for (const paragraph of paragraphs) {
		const text = transcriptParagraphToText(paragraph);
		if (!text) {
			continue;
		}

		const separatorLength = excerptParts.length > 0 ? 2 : 0;
		if (length + separatorLength + text.length > maxChars) {
			const remaining = maxChars - length - separatorLength - 3; // reserve 3 for "..."
			if (remaining > 80) {
				const truncated = text
					.slice(0, remaining)
					.replace(/\s+\S*$/, "")
					.trim();
				if (truncated) {
					excerptParts.push(`${truncated}...`);
				}
			}
			break;
		}

		excerptParts.push(text);
		length += separatorLength + text.length;
	}

	return excerptParts.join("\n\n").trim();
}

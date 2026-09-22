export interface InitialTranscriptCue {
	startSeconds: number;
	text: string;
}

export interface TranscriptChapter {
	title: string;
	startTime: number;
}

export interface TranscriptSection {
	chapter?: TranscriptChapter;
	cues: InitialTranscriptCue[];
}

export function normalizeTranscriptCues(
	cues: readonly InitialTranscriptCue[],
): InitialTranscriptCue[] {
	return cues
		.filter(
			(cue) =>
				Number.isFinite(cue.startSeconds) &&
				cue.startSeconds >= 0 &&
				typeof cue.text === "string" &&
				cue.text.trim().length > 0,
		)
		.map((cue) => ({
			startSeconds: Math.floor(cue.startSeconds),
			text: cue.text,
		}));
}

export function transcriptSections(
	cues: readonly InitialTranscriptCue[],
	chapters: readonly TranscriptChapter[],
): TranscriptSection[] {
	const validChapters = chapters
		.filter(
			(chapter) =>
				Number.isFinite(chapter.startTime) &&
				chapter.startTime >= 0 &&
				chapter.title.trim(),
		)
		.map((chapter) => ({
			...chapter,
			startTime: Math.floor(chapter.startTime),
		}))
		.sort((a, b) => a.startTime - b.startTime);
	const leading: TranscriptSection = { cues: [] };
	const sections: TranscriptSection[] = validChapters.map((chapter) => ({
		chapter,
		cues: [],
	}));
	for (const cue of cues) {
		let section = leading;
		for (const candidate of sections) {
			if (candidate.chapter && cue.startSeconds >= candidate.chapter.startTime)
				section = candidate;
			else break;
		}
		section.cues.push(cue);
	}
	return [leading, ...sections].filter((section) => section.cues.length > 0);
}

export function formatTranscriptTimestamp(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainder = String(Math.floor(seconds % 60)).padStart(2, "0");
	return hours > 0
		? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
		: `${minutes}:${remainder}`;
}

/** Literal matching only. Vue renders these fragments as text, never HTML. */
export function transcriptTextParts(
	text: string,
	query: string,
): { text: string; match: boolean }[] {
	if (query.length < 2) return [{ text, match: false }];
	const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return text
		.split(new RegExp(`(${escaped})`, "gi"))
		.map((part, index) => ({ text: part, match: index % 2 === 1 }));
}

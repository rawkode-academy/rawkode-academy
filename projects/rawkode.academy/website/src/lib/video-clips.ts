export interface VideoChapter {
	title: string;
	startTime: number;
}

export interface VideoClip {
	name: string;
	startOffset: number;
	endOffset?: number;
}

export function buildVideoClips(
	chapters: ReadonlyArray<VideoChapter>,
	durationSeconds?: number | null,
): VideoClip[] {
	const duration =
		typeof durationSeconds === "number" && Number.isFinite(durationSeconds)
			? Math.floor(durationSeconds)
			: null;

	return [...chapters]
		.map((chapter) => ({
			title: chapter.title,
			startTime: Math.max(0, Math.floor(chapter.startTime ?? 0)),
		}))
		.sort((a, b) => a.startTime - b.startTime)
		.map((chapter, index, sorted) => {
			const next = sorted[index + 1];
			const clip: VideoClip = {
				name: chapter.title,
				startOffset: chapter.startTime,
			};
			if (next) {
				clip.endOffset = next.startTime;
			} else if (duration !== null && duration > chapter.startTime) {
				clip.endOffset = duration;
			}
			return clip;
		});
}

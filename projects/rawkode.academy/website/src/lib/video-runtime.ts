export interface VideoRuntimeInput {
	duration?: number | null | undefined;
	publishedAt?: Date | string | null | undefined;
	type?: string | null | undefined;
}

export function isUpcomingLiveVideo(
	video: Pick<VideoRuntimeInput, "publishedAt" | "type">,
	now = new Date(),
): boolean {
	if (video.type !== "live" || !video.publishedAt) return false;
	const publishedAt =
		video.publishedAt instanceof Date
			? video.publishedAt
			: new Date(video.publishedAt);

	return Number.isFinite(publishedAt.getTime()) && publishedAt > now;
}

/**
 * The Academy's one runtime form: "42 min", "1h 2m", "2h". Undefined when
 * the duration is unknown, so a meta line can leave it out.
 */
export function formatRuntime(seconds?: number | null): string | undefined {
	if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0)
		return undefined;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 1) return "<1 min";
	if (minutes < 60) return `${minutes} min`;
	const hours = Math.floor(minutes / 60);
	const remainder = minutes % 60;
	return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

/** The runtime for a card's meta line: "Upcoming" for a scheduled stream. */
export function formatRuntimeLabel(
	video: VideoRuntimeInput,
	now = new Date(),
): string | undefined {
	return isUpcomingLiveVideo(video, now)
		? "Upcoming"
		: formatRuntime(video.duration);
}

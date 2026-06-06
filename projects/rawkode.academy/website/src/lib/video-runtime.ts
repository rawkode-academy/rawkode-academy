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
	const publishedAt = video.publishedAt instanceof Date
		? video.publishedAt
		: new Date(video.publishedAt);

	return Number.isFinite(publishedAt.getTime()) && publishedAt > now;
}

export function formatVideoRuntime(seconds?: number | null): string {
	if (typeof seconds !== "number" || seconds <= 0 || Number.isNaN(seconds)) {
		return "--:--";
	}
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const remainingSeconds = Math.floor(seconds % 60);

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
			.toString()
			.padStart(2, "0")}`;
	}

	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function formatVideoRuntimeLabel(
	video: VideoRuntimeInput,
	now = new Date(),
): string {
	return isUpcomingLiveVideo(video, now)
		? "Upcoming"
		: formatVideoRuntime(video.duration);
}

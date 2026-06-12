export interface StreamNotificationSource {
	slug: string;
	id?: string;
	title: string;
	origin: string;
}

export interface StreamNotificationPayload {
	dedupeKey: string;
	kind: "stream-started";
	subjectKey: string;
	title: string;
	body: string;
	url: string;
	tag: string;
	data: {
		videoSlug: string;
		videoId?: string;
	};
}

export function streamNotificationDedupeKey(slug: string): string {
	return `stream:${slug}:live-start`;
}

export function streamNotificationSubjectKey(slug: string): string {
	return `stream:${slug}`;
}

export function buildStreamNotification({
	slug,
	id,
	title,
	origin,
}: StreamNotificationSource): StreamNotificationPayload {
	return {
		dedupeKey: streamNotificationDedupeKey(slug),
		kind: "stream-started",
		subjectKey: streamNotificationSubjectKey(slug),
		title: `${title} is live`,
		body: "The stream has started on Rawkode Academy.",
		url: new URL(`/watch/${slug}`, origin).href,
		tag: `stream:${slug}`,
		data: {
			videoSlug: slug,
			...(id ? { videoId: id } : {}),
		},
	};
}

export function isUpcomingLiveVideo(
	video: { type?: string | undefined; publishedAt?: Date | undefined },
	now = new Date(),
): boolean {
	return (
		video.type === "live" &&
		video.publishedAt instanceof Date &&
		video.publishedAt.getTime() > now.getTime()
	);
}

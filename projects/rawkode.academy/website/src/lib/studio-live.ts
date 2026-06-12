export interface StudioLiveState {
	live: boolean;
	playbackUrl: string | null;
	session: {
		id: string;
		show: string;
		startedAt: number | null;
		startsAt: string;
		title: string;
	} | null;
}

export interface StudioBindingEnv {
	STUDIO?: Fetcher;
}

export interface StudioLiveGateInput {
	isLive: boolean;
	isUpcomingLive: boolean;
	liveState: StudioLiveState;
	now: Date;
	publishedAt: Date;
}

export function emptyStudioLiveState(): StudioLiveState {
	return {
		live: false,
		playbackUrl: null,
		session: null,
	};
}

export function shouldMountStudioLiveGate(input: StudioLiveGateInput): boolean {
	if (!input.isLive) return false;
	if (input.liveState.live) return true;
	if (input.isUpcomingLive) return true;

	const livePollingWindowSeconds = 4 * 60 * 60;
	return (
		input.publishedAt.getTime() + livePollingWindowSeconds * 1000 >
		input.now.getTime()
	);
}

export async function getStudioLiveState(
	env: StudioBindingEnv,
	videoSlug: string,
): Promise<StudioLiveState> {
	if (!env.STUDIO || !videoSlug.trim()) {
		return emptyStudioLiveState();
	}

	const request = new Request(studioLiveStateUrl(videoSlug));
	const response = await env.STUDIO.fetch(request).catch(() => null);
	if (!response?.ok) {
		return emptyStudioLiveState();
	}

	return parseStudioLiveState(await response.json().catch(() => null));
}

export function studioLiveStateUrl(videoSlug: string): string {
	const url = new URL("https://studio.internal/api/studio/live-state");
	url.searchParams.set("videoSlug", videoSlug.trim());
	return url.href;
}

export function parseStudioLiveState(value: unknown): StudioLiveState {
	if (!isRecord(value) || value.live !== true) {
		return emptyStudioLiveState();
	}
	if (
		typeof value.playbackUrl !== "string" ||
		value.playbackUrl.trim() === ""
	) {
		return emptyStudioLiveState();
	}

	return {
		live: true,
		playbackUrl: value.playbackUrl,
		session: parseStudioLiveSession(value.session),
	};
}

function parseStudioLiveSession(value: unknown): StudioLiveState["session"] {
	if (!isRecord(value)) return null;
	if (typeof value.id !== "string" || typeof value.title !== "string") {
		return null;
	}

	return {
		id: value.id,
		show: typeof value.show === "string" ? value.show : "",
		startedAt: typeof value.startedAt === "number" ? value.startedAt : null,
		startsAt: typeof value.startsAt === "string" ? value.startsAt : "",
		title: value.title,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

import type {
	CreateLiveEventInput,
	DestinationPlatform,
	LiveDestination,
	LiveEvent,
	ScenePreset,
	StudioParticipant,
} from "./types";

const DEFAULT_SHOW_ID = "rawkode-live";

const destinationLabels: Record<DestinationPlatform, string> = {
	youtube: "YouTube",
	twitch: "Twitch",
	linkedin: "LinkedIn",
};

export const defaultScenePresets: ScenePreset[] = [
	{
		id: "solo",
		name: "Solo host",
		layout: "solo",
		sourceSlots: ["host-camera"],
		overlayRefs: ["rawkode-live-lower-third"],
		audioPolicy: "host-focus",
	},
	{
		id: "screen-share",
		name: "Screen and host",
		layout: "screen-share",
		sourceSlots: ["screen", "host-camera"],
		overlayRefs: ["topic-bug", "rawkode-live-lower-third"],
		audioPolicy: "host-focus",
	},
	{
		id: "guest-pair",
		name: "Host and guest",
		layout: "guest-pair",
		sourceSlots: ["host-camera", "guest-1"],
		overlayRefs: ["rawkode-live-lower-third"],
		audioPolicy: "all-speakers",
	},
	{
		id: "panel",
		name: "Panel",
		layout: "panel",
		sourceSlots: ["host-camera", "guest-1", "guest-2", "screen"],
		overlayRefs: ["rawkode-live-lower-third"],
		audioPolicy: "all-speakers",
	},
	{
		id: "break",
		name: "Holding slate",
		layout: "break",
		sourceSlots: ["program-slate"],
		overlayRefs: ["stream-starting"],
		audioPolicy: "program-muted",
	},
];

export const defaultParticipants: StudioParticipant[] = [
	{
		id: "host-camera",
		role: "host",
		displayName: "Rawkode",
		sourceType: "camera",
		realtimeTrackIds: [],
		connectionState: "disconnected",
	},
	{
		id: "screen",
		role: "host",
		displayName: "Screen share",
		sourceType: "screen",
		realtimeTrackIds: [],
		connectionState: "disconnected",
	},
];

export function slugifyTitle(title: string): string {
	const slug = title
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "rawkode-live";
}

export function destinationDefaults(): LiveDestination[] {
	return (Object.keys(destinationLabels) as DestinationPlatform[]).map((platform) => ({
		platform,
		label: destinationLabels[platform],
		outputUid: null,
		rtmpUrl: null,
		secretRef: `${platform.toUpperCase()}_STREAM_KEY`,
		enabled: false,
		health: "not_configured",
		lastError: null,
	}));
}

export function createLiveEvent(input: CreateLiveEventInput, now = new Date()): LiveEvent {
	const title = input.title.trim();
	if (!title) {
		throw new Error("Live event title is required");
	}

	const id = crypto.randomUUID();
	const scheduledStart = input.scheduledStart ?? now.toISOString();
	const createdAt = now.toISOString();

	return {
		id,
		slug: input.slug ? slugifyTitle(input.slug) : slugifyTitle(title),
		title,
		showId: input.showId ?? DEFAULT_SHOW_ID,
		status: "scheduled",
		scheduledStart,
		actualStart: null,
		actualEnd: null,
		cloudflareLiveInputId: null,
		cloudflareVideoUid: null,
		chatRoomId: `rawkode-live-${id}`,
		playbackUrls: {
			streamEmbed: null,
			streamHls: null,
			whip: null,
			rtmps: null,
			srt: null,
			moq: null,
		},
		destinations: destinationDefaults(),
		scenePresets: defaultScenePresets,
		participants: defaultParticipants,
		recording: {
			mode: "program-plus-tracks",
			programRecordingUid: null,
			trackUploadPrefix: `live-events/${id}/tracks`,
			status: "armed",
			lastError: null,
		},
		createdAt,
		updatedAt: createdAt,
	};
}

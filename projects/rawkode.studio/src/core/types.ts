export const LIVE_STATUSES = [
	"draft",
	"scheduled",
	"ready",
	"preview",
	"live",
	"ended",
	"imported",
] as const;

export type LiveStatus = (typeof LIVE_STATUSES)[number];

export type DestinationPlatform = "youtube" | "twitch" | "linkedin";

export type DestinationHealth = "not_configured" | "disabled" | "ready" | "live" | "error";

export type LiveEvent = {
	id: string;
	slug: string;
	title: string;
	showId: string;
	status: LiveStatus;
	scheduledStart: string;
	actualStart: string | null;
	actualEnd: string | null;
	cloudflareLiveInputId: string | null;
	cloudflareVideoUid: string | null;
	chatRoomId: string;
	playbackUrls: {
		streamEmbed: string | null;
		streamHls: string | null;
		whip: string | null;
		rtmps: string | null;
		srt: string | null;
		moq: string | null;
	};
	destinations: LiveDestination[];
	scenePresets: ScenePreset[];
	participants: StudioParticipant[];
	recording: RecordingState;
	createdAt: string;
	updatedAt: string;
};

export type LiveDestination = {
	platform: DestinationPlatform;
	label: string;
	outputUid: string | null;
	rtmpUrl: string | null;
	secretRef: string;
	enabled: boolean;
	health: DestinationHealth;
	lastError: string | null;
};

export type StudioParticipant = {
	id: string;
	role: "host" | "guest" | "producer";
	displayName: string;
	sourceType: "camera" | "screen" | "remote" | "program";
	realtimeTrackIds: string[];
	connectionState: "invited" | "connecting" | "connected" | "muted" | "disconnected";
};

export type ScenePreset = {
	id: string;
	name: string;
	layout: "solo" | "screen-share" | "guest-pair" | "panel" | "break";
	sourceSlots: string[];
	overlayRefs: string[];
	audioPolicy: "host-focus" | "all-speakers" | "program-muted";
};

export type RecordingState = {
	mode: "program" | "program-plus-tracks";
	programRecordingUid: string | null;
	trackUploadPrefix: string | null;
	status: "idle" | "armed" | "recording" | "processing" | "ready" | "failed";
	lastError: string | null;
};

export type CreateLiveEventInput = {
	title: string;
	slug?: string;
	showId?: string;
	scheduledStart?: string;
};

export type InviteGuestInput = {
	displayName: string;
	email?: string;
};

export type ImportRecordingInput = {
	cloudflareVideoUid: string;
	archiveVideoId?: string;
};

export type StudioApiResponse<T> = {
	ok: boolean;
	data?: T;
	error?: string;
};

export function isDestinationPlatform(value: string): value is DestinationPlatform {
	return value === "youtube" || value === "twitch" || value === "linkedin";
}

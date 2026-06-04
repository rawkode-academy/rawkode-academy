import type {
	DestinationPlatform,
	ImportRecordingInput,
	InviteGuestInput,
	LiveDestination,
	LiveEvent,
	StudioParticipant,
} from "./types";
import type { CloudflareLiveInput, CloudflareStreamClient } from "./cloudflare-stream";
import { destinationConfigFromEnv } from "./cloudflare-stream";

function touch(event: LiveEvent, now = new Date()): LiveEvent {
	return { ...event, updatedAt: now.toISOString() };
}

function requireStatus(event: LiveEvent, allowed: LiveEvent["status"][], action: string) {
	if (!allowed.includes(event.status)) {
		throw new Error(`${action} cannot run while event is ${event.status}`);
	}
}

function playbackUrlsFromLiveInput(input: CloudflareLiveInput): LiveEvent["playbackUrls"] {
	return {
		streamEmbed: input.uid ? `https://iframe.videodelivery.net/${input.uid}` : null,
		streamHls: input.uid ? `https://videodelivery.net/${input.uid}/manifest/video.m3u8` : null,
		whip: input.webRTC?.url ?? null,
		rtmps: input.rtmps?.url && input.rtmps.streamKey ? `${input.rtmps.url}/${input.rtmps.streamKey}` : null,
		srt: input.srt?.url ?? null,
		moq: null,
	};
}

export async function prepareLiveInput(
	event: LiveEvent,
	client: CloudflareStreamClient | null,
	now = new Date(),
): Promise<LiveEvent> {
	requireStatus(event, ["scheduled", "ready", "preview"], "prepareLiveInput");

	if (!client) {
		return touch({
			...event,
			status: "ready",
				playbackUrls: {
					streamEmbed: null,
					streamHls: null,
					whip: null,
					rtmps: null,
					srt: null,
					moq: null,
				},
			recording: {
				...event.recording,
				status: "armed",
			},
		}, now);
	}

	const input = await client.createLiveInput(event);

	return touch({
		...event,
		status: "ready",
		cloudflareLiveInputId: input.uid,
		playbackUrls: playbackUrlsFromLiveInput(input),
		recording: {
			...event.recording,
			status: "armed",
		},
	}, now);
}

export function inviteGuest(event: LiveEvent, input: InviteGuestInput, now = new Date()): LiveEvent {
	const displayName = input.displayName.trim();
	if (!displayName) {
		throw new Error("Guest display name is required");
	}

	const participant: StudioParticipant = {
		id: `guest-${crypto.randomUUID()}`,
		role: "guest",
		displayName,
		sourceType: "remote",
		realtimeTrackIds: [],
		connectionState: "invited",
	};

	return touch({
		...event,
		participants: [...event.participants, participant],
	}, now);
}

export async function configureDestination(
	event: LiveEvent,
	platform: DestinationPlatform,
	enabled: boolean,
	env: Env,
	client: CloudflareStreamClient | null,
	now = new Date(),
): Promise<LiveEvent> {
	const destination = event.destinations.find((item) => item.platform === platform);
	if (!destination) {
		throw new Error(`Unknown destination ${platform}`);
	}

	const config = destinationConfigFromEnv(platform, env);
	const nextDestination: LiveDestination = {
		...destination,
		rtmpUrl: config.url ?? destination.rtmpUrl,
		enabled,
		health: enabled ? "ready" : "disabled",
		lastError: null,
	};

	if (!event.cloudflareLiveInputId || !client) {
		return touch({
			...event,
			destinations: event.destinations.map((item) => item.platform === platform ? nextDestination : item),
		}, now);
	}

	if (!nextDestination.outputUid) {
		if (!config.streamKey) {
			const errored = {
				...nextDestination,
				health: "error" as const,
				lastError: `${nextDestination.label} stream key is not configured`,
			};
			return touch({
				...event,
				destinations: event.destinations.map((item) => item.platform === platform ? errored : item),
			}, now);
		}

		const output = await client.createOutput(event.cloudflareLiveInputId, nextDestination, config.streamKey);
		nextDestination.outputUid = output.uid;
		nextDestination.health = output.enabled ? "ready" : "disabled";
	} else {
		const output = await client.updateOutput(event.cloudflareLiveInputId, nextDestination.outputUid, enabled);
		nextDestination.health = output.enabled ? "ready" : "disabled";
	}

	return touch({
		...event,
		destinations: event.destinations.map((item) => item.platform === platform ? nextDestination : item),
	}, now);
}

export function startPreview(event: LiveEvent, now = new Date()): LiveEvent {
	requireStatus(event, ["ready", "preview"], "startPreview");
	return touch({ ...event, status: "preview" }, now);
}

export function goLive(event: LiveEvent, now = new Date()): LiveEvent {
	requireStatus(event, ["ready", "preview"], "goLive");
	return touch({
		...event,
		status: "live",
		actualStart: event.actualStart ?? now.toISOString(),
		recording: {
			...event.recording,
			status: "recording",
		},
		destinations: event.destinations.map((destination) => ({
			...destination,
			health: destination.enabled ? "live" : destination.health,
		})),
	}, now);
}

export function endLive(event: LiveEvent, now = new Date()): LiveEvent {
	requireStatus(event, ["preview", "live"], "endLive");
	return touch({
		...event,
		status: "ended",
		actualEnd: event.actualEnd ?? now.toISOString(),
		recording: {
			...event.recording,
			status: "processing",
		},
		destinations: event.destinations.map((destination) => ({
			...destination,
			health: destination.enabled ? "ready" : destination.health,
		})),
	}, now);
}

export function importRecording(event: LiveEvent, input: ImportRecordingInput, now = new Date()): LiveEvent {
	if (!input.cloudflareVideoUid.trim()) {
		throw new Error("Cloudflare recording video uid is required");
	}

	return touch({
		...event,
		status: "imported",
		cloudflareVideoUid: input.cloudflareVideoUid,
		recording: {
			...event.recording,
			programRecordingUid: input.cloudflareVideoUid,
			status: "ready",
		},
	}, now);
}

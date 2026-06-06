export interface RealtimeKitWebhookPayload {
	event?: string;
	streamId?: string;
	status?: string;
	meeting?: {
		id?: string;
		sessionId?: string;
		title?: string;
		roomName?: string;
		status?: string;
	};
}

export interface RealtimeKitLivestream {
	id?: string;
	meeting_id?: string;
	name?: string;
	status?: string;
}

export interface RealtimeKitVideoCandidate {
	slug: string;
	title?: string;
	realtimeKit?: {
		streamId?: string | undefined;
		meetingId?: string | undefined;
		livestreamName?: string | undefined;
		roomName?: string | undefined;
	} | undefined;
}

export function isRealtimeKitLiveStartEvent(
	payload: RealtimeKitWebhookPayload,
): boolean {
	const status = payload.status?.toUpperCase();
	return payload.event === "livestreaming.statusUpdate" && status === "LIVE";
}

function normalizeIdentifier(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

export function realtimeKitVideoMatchesPayload(
	video: RealtimeKitVideoCandidate,
	payload: RealtimeKitWebhookPayload,
	livestream?: RealtimeKitLivestream | null,
): boolean {
	const mapping = video.realtimeKit;
	const streamId = normalizeIdentifier(payload.streamId);
	const meetingId =
		normalizeIdentifier(payload.meeting?.id) ??
		normalizeIdentifier(livestream?.meeting_id);
	const roomName = normalizeIdentifier(payload.meeting?.roomName);
	const livestreamName = normalizeIdentifier(livestream?.name);

	return (
		(mapping?.streamId !== undefined && mapping.streamId === streamId) ||
		(mapping?.meetingId !== undefined && mapping.meetingId === meetingId) ||
		(mapping?.roomName !== undefined && mapping.roomName === roomName) ||
		(mapping?.livestreamName !== undefined &&
			mapping.livestreamName === livestreamName) ||
		video.slug === livestreamName ||
		video.slug === roomName
	);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
	const binary = atob(value);
	const buffer = new ArrayBuffer(binary.length);
	const bytes = new Uint8Array(buffer);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return buffer;
}

function publicKeyPemToSpki(publicKeyPem: string): ArrayBuffer {
	const base64 = publicKeyPem
		.replace(/-----BEGIN PUBLIC KEY-----/g, "")
		.replace(/-----END PUBLIC KEY-----/g, "")
		.replace(/\s/g, "");
	return base64ToArrayBuffer(base64);
}

export async function verifyRealtimeKitWebhookSignature(
	payload: RealtimeKitWebhookPayload | string,
	signature: string | null,
	publicKeyPem: string,
): Promise<boolean> {
	if (!signature) return false;
	const payloadText =
		typeof payload === "string" ? payload : JSON.stringify(payload);

	const publicKey = await crypto.subtle.importKey(
		"spki",
		publicKeyPemToSpki(publicKeyPem),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);

	return crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		publicKey,
		base64ToArrayBuffer(signature),
		new TextEncoder().encode(payloadText),
	);
}

export function realtimeKitNotificationData(
	payload: RealtimeKitWebhookPayload,
): Record<string, string> {
	return {
		realtimeKitEvent: payload.event ?? "unknown",
		...(payload.streamId ? { realtimeKitStreamId: payload.streamId } : {}),
		...(payload.status ? { realtimeKitStatus: payload.status } : {}),
		...(payload.meeting?.id
			? { realtimeKitMeetingId: payload.meeting.id }
			: {}),
		...(payload.meeting?.sessionId
			? { realtimeKitSessionId: payload.meeting.sessionId }
			: {}),
		...(payload.meeting?.roomName
			? { realtimeKitRoomName: payload.meeting.roomName }
			: {}),
	};
}

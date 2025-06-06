import {
	LIVEKIT_API_KEY,
	LIVEKIT_API_SECRET,
	LIVEKIT_URL,
} from "astro:env/server";
import {
	EgressClient,
	RoomServiceClient,
	TokenVerifier,
	WebhookReceiver,
} from "livekit-server-sdk";

export const roomClientService = new RoomServiceClient(
	LIVEKIT_URL,
	LIVEKIT_API_KEY,
	LIVEKIT_API_SECRET,
);

export const egressClient = new EgressClient(
	LIVEKIT_URL,
	LIVEKIT_API_KEY,
	LIVEKIT_API_SECRET,
);

export const webhookReceiver = new WebhookReceiver(
	LIVEKIT_API_KEY,
	LIVEKIT_API_SECRET,
);

export const tokenVerifier = new TokenVerifier(
	LIVEKIT_API_KEY,
	LIVEKIT_API_SECRET,
);

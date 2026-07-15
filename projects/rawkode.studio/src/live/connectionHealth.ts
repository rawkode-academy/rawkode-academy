export type WebRtcConnectionHealth =
	| "connecting"
	| "degraded"
	| "failed"
	| "healthy";

export function getWebRtcConnectionHealth(
	state: RTCPeerConnectionState,
): WebRtcConnectionHealth {
	if (state === "connected") return "healthy";
	if (state === "disconnected") return "degraded";
	if (state === "failed" || state === "closed") return "failed";
	return "connecting";
}

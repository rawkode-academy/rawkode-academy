export function resolveWebRtcSessionResourceUrl(
	endpointUrl: string,
	response: Pick<Response, "headers">,
): string | null {
	const location = response.headers.get("Location");
	return location ? new URL(location, endpointUrl).href : null;
}

export async function waitForIceGathering(
	peerConnection: RTCPeerConnection,
	signal?: AbortSignal,
): Promise<void> {
	if (peerConnection.iceGatheringState === "complete") {
		return;
	}

	await new Promise<void>((resolve) => {
		const timeout = window.setTimeout(finish, 5000);
		function finish() {
			window.clearTimeout(timeout);
			peerConnection.removeEventListener("icegatheringstatechange", onChange);
			signal?.removeEventListener("abort", finish);
			resolve();
		}
		function onChange() {
			if (peerConnection.iceGatheringState === "complete") {
				finish();
			}
		}
		signal?.addEventListener("abort", finish, { once: true });
		peerConnection.addEventListener("icegatheringstatechange", onChange);
	});
}

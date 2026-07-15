import {
	resolveWebRtcSessionResourceUrl,
	waitForIceGathering,
} from "./webrtcSession";

export interface WhepPlaybackSession {
	close: () => Promise<void>;
	connectionState: () => RTCPeerConnectionState;
	onConnectionStateChange: (
		listener: (state: RTCPeerConnectionState) => void,
	) => () => void;
	stream: MediaStream;
}

export async function startWhepPlayback(input: {
	playbackUrl: string;
	signal?: AbortSignal;
}): Promise<WhepPlaybackSession> {
	const peerConnection = new RTCPeerConnection();
	const stream = new MediaStream();
	let resourceUrl: string | null = null;
	let deletedResourceUrl: string | null = null;
	let closed = false;
	const connectionStateListeners = new Set<
		(state: RTCPeerConnectionState) => void
	>();
	const emitConnectionState = () => {
		for (const listener of connectionStateListeners) {
			listener(peerConnection.connectionState);
		}
	};
	const handleTrack = (event: RTCTrackEvent) => {
		if (!stream.getTracks().some((track) => track.id === event.track.id)) {
			stream.addTrack(event.track);
		}
	};
	peerConnection.addEventListener("connectionstatechange", emitConnectionState);
	peerConnection.addEventListener("track", handleTrack);

	const close = async () => {
		input.signal?.removeEventListener("abort", handleAbort);
		if (!closed) {
			closed = true;
			peerConnection.removeEventListener(
				"connectionstatechange",
				emitConnectionState,
			);
			peerConnection.removeEventListener("track", handleTrack);
			connectionStateListeners.clear();
			peerConnection.close();
			for (const track of stream.getTracks()) {
				track.stop();
			}
		}
		if (resourceUrl && deletedResourceUrl !== resourceUrl) {
			deletedResourceUrl = resourceUrl;
			await fetch(resourceUrl, { method: "DELETE" }).catch(() => undefined);
		}
	};
	function handleAbort() {
		void close();
	}
	input.signal?.addEventListener("abort", handleAbort, { once: true });

	try {
		if (input.signal?.aborted) {
			throw new Error("WHEP playback stopped.");
		}
		peerConnection.addTransceiver("audio", { direction: "recvonly" });
		peerConnection.addTransceiver("video", { direction: "recvonly" });
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		await waitForIceGathering(peerConnection, input.signal);

		const localDescription = peerConnection.localDescription;
		if (!localDescription?.sdp) {
			throw new Error("Unable to create WHEP offer.");
		}

		const response = await fetch(input.playbackUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/sdp",
			},
			body: localDescription.sdp,
			signal: input.signal,
		});
		if (!response.ok) {
			throw new Error(`WHEP playback failed with ${response.status}.`);
		}
		resourceUrl = resolveWebRtcSessionResourceUrl(input.playbackUrl, response);

		const answer = await response.text();
		await peerConnection.setRemoteDescription({
			type: "answer",
			sdp: answer,
		});
		if (input.signal?.aborted) {
			throw new Error("WHEP playback stopped.");
		}
	} catch (error) {
		await close();
		throw error;
	}

	return {
		connectionState: () => peerConnection.connectionState,
		onConnectionStateChange: (listener) => {
			connectionStateListeners.add(listener);
			listener(peerConnection.connectionState);
			return () => connectionStateListeners.delete(listener);
		},
		close,
		stream,
	};
}

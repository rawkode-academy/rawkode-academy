export interface WhipPublishSession {
	close: () => Promise<void>;
	connectionState: () => RTCPeerConnectionState;
}

export async function startWhipPublishing(input: {
	publishUrl: string;
	signal?: AbortSignal;
	stream: MediaStream;
}): Promise<WhipPublishSession> {
	const peerConnection = new RTCPeerConnection();
	let resourceUrl: string | null = null;
	let deletedResourceUrl: string | null = null;
	let closed = false;
	const close = async () => {
		if (!closed) {
			closed = true;
			peerConnection.close();
		}
		if (resourceUrl && deletedResourceUrl !== resourceUrl) {
			deletedResourceUrl = resourceUrl;
			await fetch(resourceUrl, { method: "DELETE" }).catch(() => undefined);
		}
	};
	const handleAbort = () => {
		void close();
	};
	input.signal?.addEventListener("abort", handleAbort, { once: true });
	for (const track of input.stream.getTracks()) {
		peerConnection.addTrack(track, input.stream);
	}

	try {
		if (input.signal?.aborted) {
			throw new Error("WHIP publish stopped.");
		}
		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		await waitForIceGathering(peerConnection, input.signal);

		const localDescription = peerConnection.localDescription;
		if (!localDescription?.sdp) {
			throw new Error("Unable to create WHIP offer.");
		}

		const response = await fetch(input.publishUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/sdp",
			},
			body: localDescription.sdp,
			signal: input.signal,
		});
		if (!response.ok) {
			throw new Error(`WHIP publish failed with ${response.status}.`);
		}
		resourceUrl = getWhipResourceUrl(input.publishUrl, response);

		const answer = await response.text();
		await peerConnection.setRemoteDescription({
			type: "answer",
			sdp: answer,
		});
		if (input.signal?.aborted) {
			throw new Error("WHIP publish stopped.");
		}
	} catch (error) {
		await close();
		throw error;
	} finally {
		input.signal?.removeEventListener("abort", handleAbort);
	}

	return {
		connectionState: () => peerConnection.connectionState,
		close: async () => {
			await close();
		},
	};
}

function getWhipResourceUrl(publishUrl: string, response: Response): string | null {
	const location = response.headers.get("Location");
	if (!location) return null;
	return new URL(location, publishUrl).href;
}

async function waitForIceGathering(
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

export interface WhipPublishSession {
	close: () => Promise<void>;
	connectionState: () => RTCPeerConnectionState;
	onConnectionStateChange: (
		listener: (state: RTCPeerConnectionState) => void,
	) => () => void;
}

export interface WhipTerminalConnectionMonitor {
	activate: () => void;
	dispose: () => void;
}

export class PublisherOperationTimeoutError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "PublisherOperationTimeoutError";
	}
}

// Abort the underlying operation and stop waiting even when an implementation
// ignores AbortSignal. A late result must never revive a canceled start.
export async function runBoundedPublisherOperation<T>(
	operation: (signal: AbortSignal) => Promise<T>,
	options: { signal?: AbortSignal; timeoutMs: number; timeoutMessage: string },
): Promise<T> {
	const controller = new AbortController();
	const timeoutMs = Math.max(1, options.timeoutMs);
	const deadline = performance.now() + timeoutMs;
	let interruptionReason: Error | undefined;
	let rejectInterruption!: (error: Error) => void;
	const interruption = new Promise<never>((_resolve, reject) => {
		rejectInterruption = reject;
	});
	const interrupt = (error: Error) => {
		if (interruptionReason) return;
		interruptionReason = error;
		rejectInterruption(error);
		controller.abort();
	};
	const abort = () => interrupt(new DOMException("Publisher operation canceled.", "AbortError"));
	if (options.signal?.aborted) abort();
	else options.signal?.addEventListener("abort", abort, { once: true });
	const timeout = setTimeout(
		() => interrupt(new PublisherOperationTimeoutError(options.timeoutMessage)),
		timeoutMs,
	);

	try {
		if (controller.signal.aborted) return await interruption;
		const result = await Promise.race([operation(controller.signal), interruption]);
		if (interruptionReason) throw interruptionReason;
		if (performance.now() >= deadline) {
			controller.abort();
			throw new PublisherOperationTimeoutError(options.timeoutMessage);
		}
		return result;
	} finally {
		clearTimeout(timeout);
		options.signal?.removeEventListener("abort", abort);
	}
}

const TERMINAL_WHIP_CONNECTION_STATES = new Set<RTCPeerConnectionState>([
	"closed",
	"disconnected",
	"failed",
]);

export function isTerminalWhipConnectionState(
	state: RTCPeerConnectionState,
): boolean {
	return TERMINAL_WHIP_CONNECTION_STATES.has(state);
}

export function createWhipTerminalConnectionMonitor(
	session: WhipPublishSession,
	onTerminal: (state: RTCPeerConnectionState) => void | Promise<void>,
	options: { disconnectedGraceMs?: number } = {},
): WhipTerminalConnectionMonitor {
	let active = false;
	let disposed = false;
	let terminalHandled = false;
	let disconnectedTimer: ReturnType<typeof setTimeout> | undefined;
	const disconnectedGraceMs = Math.max(0, options.disconnectedGraceMs ?? 5_000);
	const clearDisconnectedTimer = () => {
		if (disconnectedTimer !== undefined) {
			clearTimeout(disconnectedTimer);
			disconnectedTimer = undefined;
		}
	};
	const handleTerminal = (state: RTCPeerConnectionState) => {
		clearDisconnectedTimer();
		terminalHandled = true;
		void onTerminal(state);
	};
	const handleState = (state: RTCPeerConnectionState) => {
		if (!active || disposed || terminalHandled) {
			return;
		}
		if (state === "disconnected") {
			if (disconnectedTimer === undefined) {
				disconnectedTimer = setTimeout(() => {
					disconnectedTimer = undefined;
					if (
						active &&
						!disposed &&
						!terminalHandled &&
						session.connectionState() === "disconnected"
					) {
						handleTerminal("disconnected");
					}
				}, disconnectedGraceMs);
			}
			return;
		}
		clearDisconnectedTimer();
		if (state === "closed" || state === "failed") {
			handleTerminal(state);
		}
	};
	const unsubscribe = session.onConnectionStateChange(handleState);

	return {
		activate: () => {
			if (disposed || active) {
				return;
			}
			active = true;
			handleState(session.connectionState());
		},
		dispose: () => {
			if (disposed) {
				return;
			}
			disposed = true;
			clearDisconnectedTimer();
			unsubscribe();
		},
	};
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
	const connectionStateListeners = new Set<
		(state: RTCPeerConnectionState) => void
	>();
	const handleConnectionStateChange = () => {
		if (closed) {
			return;
		}
		for (const listener of connectionStateListeners) {
			listener(peerConnection.connectionState);
		}
	};
	peerConnection.addEventListener(
		"connectionstatechange",
		handleConnectionStateChange,
	);
	const close = async () => {
		if (!closed) {
			closed = true;
			peerConnection.removeEventListener(
				"connectionstatechange",
				handleConnectionStateChange,
			);
			connectionStateListeners.clear();
			peerConnection.close();
		}
		if (resourceUrl && deletedResourceUrl !== resourceUrl) {
			const deleteUrl = resourceUrl;
			deletedResourceUrl = deleteUrl;
			// Local peer shutdown must not wait for a provider DELETE that can hang.
			void runBoundedPublisherOperation(
				(signal) => fetch(deleteUrl, { method: "DELETE", signal }),
				{ timeoutMs: 5_000, timeoutMessage: "WHIP resource cleanup timed out." },
			).catch(() => undefined);
		}
	};
	const handleAbort = () => {
		void close();
	};
	input.signal?.addEventListener("abort", handleAbort, { once: true });

	try {
		if (input.signal?.aborted) {
			throw new Error("WHIP publish stopped.");
		}
		for (const track of input.stream.getTracks()) {
			peerConnection.addTransceiver(track, {
				direction: "sendonly",
				streams: [input.stream],
			});
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
		if (closed || input.signal?.aborted) {
			await close();
			throw new Error("WHIP publish stopped.");
		}

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
		onConnectionStateChange: (listener) => {
			if (closed) {
				return () => undefined;
			}
			connectionStateListeners.add(listener);
			return () => connectionStateListeners.delete(listener);
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

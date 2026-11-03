type PlaybackStatus = "connecting" | "failed" | "live";

async function bounded<T>(
	operation: (signal: AbortSignal) => Promise<T>,
	options: { signal?: AbortSignal; timeoutMs: number },
): Promise<T> {
	const controller = new AbortController();
	const deadline = Date.now() + options.timeoutMs;
	const monotonicDeadline = performance.now() + options.timeoutMs;
	let reason: Error | undefined;
	let rejectInterrupted!: (error: Error) => void;
	const interrupted = new Promise<never>((_resolve, reject) => { rejectInterrupted = reject; });
	const interrupt = (error: Error) => {
		if (reason) return;
		reason = error;
		rejectInterrupted(error);
		controller.abort();
	};
	const abort = () => interrupt(new DOMException("Live viewer operation canceled.", "AbortError"));
	if (options.signal?.aborted) abort();
	else options.signal?.addEventListener("abort", abort, { once: true });
	const timer = setTimeout(() => interrupt(new Error("Live viewer request timed out.")), options.timeoutMs);
	try {
		if (controller.signal.aborted) return await interrupted;
		const result = await Promise.race([operation(controller.signal), interrupted]);
		if (reason) throw reason;
		if (Date.now() >= deadline || performance.now() >= monotonicDeadline) {
			controller.abort();
			throw new Error("Live viewer request timed out.");
		}
		return result;
	} finally {
		clearTimeout(timer);
		options.signal?.removeEventListener("abort", abort);
	}
}

export function createLiveStatePoller<T>(options: {
	load(signal: AbortSignal): Promise<T>;
	onState(state: T): void;
	onUnavailable(): void;
	timeoutMs?: number;
}): { refresh(): Promise<void>; dispose(): void } {
	let generation = 0;
	let disposed = false;
	let current: AbortController | undefined;
	return {
		async refresh() {
			if (disposed) return;
			const version = ++generation;
			current?.abort();
			const controller = new AbortController();
			current = controller;
			try {
				const state = await bounded(options.load, { signal: controller.signal, timeoutMs: options.timeoutMs ?? 8_000 });
				if (!disposed && generation === version) options.onState(state);
			} catch {
				if (!disposed && generation === version) options.onUnavailable();
			} finally {
				if (current === controller) current = undefined;
			}
		},
		dispose() {
			disposed = true;
			generation += 1;
			current?.abort();
			current = undefined;
		},
	};
}

interface PlaybackAttempt {
	controller: AbortController;
	peer: RTCPeerConnection;
	stream: MediaStream;
	url: string;
	version: number;
	resourceUrl: string | null;
	deletedResourceUrl: string | null;
	mediaDeadline: number;
	mediaMonotonicDeadline: number;
	mediaTimer?: ReturnType<typeof setTimeout>;
	negotiated: boolean;
	receivedMedia: boolean;
	onTrack: (event: RTCTrackEvent) => void;
	onConnectionStateChange: () => void;
	onMediaReady: () => void;
}

export function createWhepPlayback(options: {
	video: HTMLVideoElement;
	onStatus(status: PlaybackStatus, message?: string): void;
	connectTimeoutMs?: number;
	deleteTimeoutMs?: number;
	retryMs?: number;
}): { connect(url: string): void; dispose(): void } {
	let generation = 0;
	let disposed = false;
	let current: PlaybackAttempt | undefined;
	let retryTimer: ReturnType<typeof setTimeout> | undefined;

	function clearRetry(): void {
		if (retryTimer !== undefined) clearTimeout(retryTimer);
		retryTimer = undefined;
	}

	function isCurrent(attempt: PlaybackAttempt): boolean {
		return !disposed && current === attempt && generation === attempt.version && !attempt.controller.signal.aborted;
	}

	function deleteResource(attempt: PlaybackAttempt): void {
		if (!attempt.resourceUrl || attempt.deletedResourceUrl === attempt.resourceUrl) return;
		const url = attempt.resourceUrl;
		attempt.deletedResourceUrl = url;
		void bounded((signal) => fetch(url, { method: "DELETE", signal }), {
			timeoutMs: options.deleteTimeoutMs ?? 5_000,
		}).catch(() => undefined);
	}

	function closeAttempt(attempt: PlaybackAttempt): void {
		if (current === attempt) current = undefined;
		attempt.controller.abort();
		if (attempt.mediaTimer !== undefined) clearTimeout(attempt.mediaTimer);
		attempt.mediaTimer = undefined;
		options.video.removeEventListener("loadeddata", attempt.onMediaReady);
		options.video.removeEventListener("playing", attempt.onMediaReady);
		attempt.peer.removeEventListener("track", attempt.onTrack);
		attempt.peer.removeEventListener("connectionstatechange", attempt.onConnectionStateChange);
		attempt.peer.close();
		if (options.video.srcObject === attempt.stream) {
			options.video.pause();
			options.video.srcObject = null;
		}
		deleteResource(attempt);
	}

	function retry(attempt: PlaybackAttempt, error?: unknown): void {
		if (!isCurrent(attempt)) return;
		closeAttempt(attempt);
		options.onStatus(error ? "failed" : "connecting", error instanceof Error ? error.message : undefined);
		clearRetry();
		retryTimer = setTimeout(() => {
			retryTimer = undefined;
			if (!disposed && generation === attempt.version) connect(attempt.url);
		}, options.retryMs ?? 5_000);
	}

	function markMediaReceived(attempt: PlaybackAttempt): void {
		if (!isCurrent(attempt) || attempt.receivedMedia) return;
		if (Date.now() >= attempt.mediaDeadline || performance.now() >= attempt.mediaMonotonicDeadline) {
			retry(attempt, new Error("Live playback did not receive video."));
			return;
		}
		attempt.receivedMedia = true;
		if (attempt.mediaTimer !== undefined) clearTimeout(attempt.mediaTimer);
		attempt.mediaTimer = undefined;
		if (attempt.negotiated) options.onStatus("live");
	}

	async function negotiate(attempt: PlaybackAttempt, signal: AbortSignal): Promise<void> {
		attempt.peer.addTransceiver("video", { direction: "recvonly" });
		attempt.peer.addTransceiver("audio", { direction: "recvonly" });
		const offer = await attempt.peer.createOffer();
		await attempt.peer.setLocalDescription(offer);
		await waitForIceGathering(attempt.peer, signal);
		if (!isCurrent(attempt) || signal.aborted) throw new Error("Live playback stopped.");
		if (!attempt.peer.localDescription?.sdp) throw new Error("Unable to create WHEP offer.");
		const response = await fetch(attempt.url, {
			method: "POST", headers: { "Content-Type": "application/sdp" },
			body: attempt.peer.localDescription.sdp, signal,
		});
		if (!response.ok) throw new Error(`Live playback failed with ${response.status}.`);
		const location = response.headers.get("Location");
		attempt.resourceUrl = location ? new URL(location, attempt.url).href : null;
		if (!isCurrent(attempt) || signal.aborted) {
			deleteResource(attempt);
			throw new Error("Live playback stopped.");
		}
		const answer = await response.text();
		if (!isCurrent(attempt) || signal.aborted) throw new Error("Live playback stopped.");
		await attempt.peer.setRemoteDescription({ type: "answer", sdp: answer });
		if (!isCurrent(attempt) || signal.aborted) throw new Error("Live playback stopped.");
	}

	function connect(url: string): void {
		if (disposed) return;
		const version = ++generation;
		clearRetry();
		if (current) closeAttempt(current);
		if (!url) return;
		let attempt: PlaybackAttempt;
		const timeoutMs = options.connectTimeoutMs ?? 15_000;
		try {
			const stream = new MediaStream();
			const peer = new RTCPeerConnection();
			attempt = {
				controller: new AbortController(), peer, stream,
				url, version, resourceUrl: null, deletedResourceUrl: null,
				mediaDeadline: Date.now() + timeoutMs, mediaMonotonicDeadline: performance.now() + timeoutMs,
				negotiated: false, receivedMedia: false,
				onTrack: () => undefined, onConnectionStateChange: () => undefined, onMediaReady: () => undefined,
			};
		} catch (error) {
			options.onStatus("failed", error instanceof Error ? error.message : "Live playback failed.");
			retryTimer = setTimeout(() => {
				if (!disposed && generation === version) connect(url);
			}, options.retryMs ?? 5_000);
			return;
		}
		current = attempt;
		attempt.onTrack = (event) => {
			if (!isCurrent(attempt)) return;
			attempt.stream.addTrack(event.track);
			if (options.video.srcObject !== attempt.stream) options.video.srcObject = attempt.stream;
			void options.video.play().catch(() => undefined);
		};
		attempt.onMediaReady = () => {
			if (options.video.srcObject === attempt.stream && options.video.readyState >= 2 &&
				options.video.videoWidth > 0 && options.video.videoHeight > 0) markMediaReceived(attempt);
		};
		attempt.onConnectionStateChange = () => {
			if (attempt.peer.connectionState === "failed" || attempt.peer.connectionState === "disconnected") retry(attempt);
		};
		attempt.peer.addEventListener("track", attempt.onTrack);
		attempt.peer.addEventListener("connectionstatechange", attempt.onConnectionStateChange);
		options.video.addEventListener("loadeddata", attempt.onMediaReady);
		options.video.addEventListener("playing", attempt.onMediaReady);
		options.onStatus("connecting");
		void bounded((signal) => negotiate(attempt, signal), {
			signal: attempt.controller.signal, timeoutMs,
		}).then(() => {
			if (!isCurrent(attempt)) return;
			attempt.negotiated = true;
			if (attempt.receivedMedia) {
				options.onStatus("live");
				return;
			}
			// SDP may complete without a video track or any received video. Keep a
			// separate deadline after negotiation until video arrives.
			attempt.mediaDeadline = Date.now() + timeoutMs;
			attempt.mediaMonotonicDeadline = performance.now() + timeoutMs;
			attempt.mediaTimer = setTimeout(() => retry(attempt, new Error("Live playback did not receive video.")), timeoutMs);
		}).catch((error: unknown) => retry(attempt, error));
	}

	return {
		connect,
		dispose() {
			disposed = true;
			generation += 1;
			clearRetry();
			if (current) closeAttempt(current);
		},
	};
}

async function waitForIceGathering(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
	if (peer.iceGatheringState === "complete" || signal.aborted) return;
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(finish, 5_000);
		function finish() {
			clearTimeout(timeout);
			peer.removeEventListener("icegatheringstatechange", onChange);
			signal.removeEventListener("abort", finish);
			resolve();
		}
		function onChange() { if (peer.iceGatheringState === "complete") finish(); }
		signal.addEventListener("abort", finish, { once: true });
		peer.addEventListener("icegatheringstatechange", onChange);
		if (signal.aborted) finish();
	});
}

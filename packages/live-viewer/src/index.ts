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
	onTrack: (event: RTCTrackEvent) => void;
	onConnectionStateChange: () => void;
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
		try {
			const stream = new MediaStream();
			const peer = new RTCPeerConnection();
			attempt = {
				controller: new AbortController(), peer, stream,
				url, version, resourceUrl: null, deletedResourceUrl: null,
				onTrack: () => undefined, onConnectionStateChange: () => undefined,
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
			options.video.srcObject = attempt.stream;
			void options.video.play().catch(() => undefined);
			options.onStatus("live");
		};
		attempt.onConnectionStateChange = () => {
			if (attempt.peer.connectionState === "failed" || attempt.peer.connectionState === "disconnected") retry(attempt);
		};
		attempt.peer.addEventListener("track", attempt.onTrack);
		attempt.peer.addEventListener("connectionstatechange", attempt.onConnectionStateChange);
		options.onStatus("connecting");
		void bounded((signal) => negotiate(attempt, signal), {
			signal: attempt.controller.signal, timeoutMs: options.connectTimeoutMs ?? 15_000,
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

import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { createLiveStatePoller, createWhepPlayback } from "@rawkodeacademy/live-viewer";

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => { resolve = done; });
	return { promise, resolve };
}

async function flush() {
	for (let index = 0; index < 40; index += 1) await Promise.resolve();
}

const originals = new Map<string, PropertyDescriptor | undefined>();
function stubGlobal(name: string, value: unknown) {
	if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
	Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

class FakeTrack {
	muted = true;
	readyState = "live";
	listeners = new Set<() => void>();
	history: Array<() => void> = [];
	constructor(readonly id: string, readonly kind: "audio" | "video" = "video") {}
	addEventListener(type: string, callback: () => void) {
		if (type === "unmute") { this.listeners.add(callback); this.history.push(callback); }
	}
	removeEventListener(type: string, callback: () => void) {
		if (type === "unmute") this.listeners.delete(callback);
	}
	unmute() { this.muted = false; for (const listener of this.listeners) listener(); }
	lateUnmute() { this.muted = false; for (const listener of this.history) listener(); }
}

class FakeStream {
	tracks: unknown[] = [];
	addTrack(track: unknown) { this.tracks.push(track); }
}

class FakeVideo {
	srcObject: unknown = null;
	readyState = 0;
	videoWidth = 0;
	videoHeight = 0;
	pause = vi.fn();
	play = vi.fn(async () => {});
	listeners = new Map<string, Set<() => void>>();
	history = new Map<string, Array<() => void>>();
	addEventListener(type: string, callback: () => void) {
		const listeners = this.listeners.get(type) ?? new Set();
		listeners.add(callback);
		this.listeners.set(type, listeners);
		const callbacks = this.history.get(type) ?? [];
		callbacks.push(callback);
		this.history.set(type, callbacks);
	}
	removeEventListener(type: string, callback: () => void) { this.listeners.get(type)?.delete(callback); }
	emit(type: string) { for (const callback of this.listeners.get(type) ?? []) callback(); }
}

class FakePeer {
	connectionState = "connected";
	iceGatheringState = "complete";
	localDescription: RTCSessionDescriptionInit | null = null;
	listeners = new Map<string, Set<(...args: never[]) => void>>();
	trackListeners: Array<(event: { track: unknown }) => void> = [];
	stateListeners: Array<() => void> = [];
	closed = false;
	addEventListener(type: string, callback: (...args: never[]) => void) {
		const listeners = this.listeners.get(type) ?? new Set();
		listeners.add(callback);
		this.listeners.set(type, listeners);
		if (type === "track") this.trackListeners.push(callback as (event: { track: unknown }) => void);
		if (type === "connectionstatechange") this.stateListeners.push(callback);
	}
	removeEventListener(type: string, callback: (...args: never[]) => void) { this.listeners.get(type)?.delete(callback); }
	addTransceiver() {}
	async createOffer() { return { type: "offer", sdp: "offer" }; }
	async setLocalDescription(description: RTCSessionDescriptionInit) { this.localDescription = description; }
	async setRemoteDescription() {}
	close() { this.closed = true; }
	track(track: unknown) { for (const listener of this.trackListeners) listener({ track }); }
	state(value: string) {
		this.connectionState = value;
		for (const listener of this.listeners.get("connectionstatechange") ?? []) listener();
	}
	lateState(value: string) {
		this.connectionState = value;
		for (const listener of this.stateListeners) listener();
	}
}

let peers: FakePeer[];
let video: FakeVideo;

beforeEach(() => {
	vi.useFakeTimers();
	peers = [];
	video = new FakeVideo();
	stubGlobal("MediaStream", FakeStream);
	stubGlobal("RTCPeerConnection", class extends FakePeer { constructor() { super(); peers.push(this); } });
});

afterEach(() => {
	vi.useRealTimers();
	for (const [name, descriptor] of originals) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
	originals.clear();
});

describe("live state polling", () => {
	it("ignores an older response that arrives after a newer one", async () => {
		const first = deferred<string>();
		const second = deferred<string>();
		const states: string[] = [];
		let count = 0;
		const poller = createLiveStatePoller({
			load: () => ++count === 1 ? first.promise : second.promise,
			onState: (value) => { states.push(value); },
			onUnavailable: () => { states.push("unavailable"); },
		});
		const older = poller.refresh();
		const newer = poller.refresh();
		second.resolve("replacement");
		await newer;
		first.resolve("old");
		await older;
		await flush();
		expect(states).toEqual(["replacement"]);
		poller.dispose();
	});

	it("clears stale live state on a hung refresh and permits a later retry", async () => {
		const late = deferred<string>();
		const states: string[] = ["previous live"];
		let signal: AbortSignal | undefined;
		let count = 0;
		const poller = createLiveStatePoller({
			load: (input) => { signal = input; return ++count === 1 ? late.promise : Promise.resolve("replacement"); },
			onState: (value) => { states.push(value); },
			onUnavailable: () => { states.push("unavailable"); },
			timeoutMs: 1_000,
		});
		const pending = poller.refresh();
		vi.advanceTimersByTime(1_000);
		await pending;
		expect(signal?.aborted).toBe(true);
		expect(states).toEqual(["previous live", "unavailable"]);
		await poller.refresh();
		late.resolve("old");
		await flush();
		expect(states).toEqual(["previous live", "unavailable", "replacement"]);
		poller.dispose();
	});

	it("does not restore an old live state after the latest refresh fails", async () => {
		const old = deferred<string>();
		let calls = 0;
		const states: string[] = [];
		const poller = createLiveStatePoller({
			load: () => ++calls === 1 ? old.promise : Promise.reject(new Error("offline")),
			onState: (value) => { states.push(value); },
			onUnavailable: () => { states.push("unavailable"); },
		});
		const pending = poller.refresh();
		await poller.refresh();
		old.resolve("old live");
		await pending;
		await flush();
		expect(states).toEqual(["unavailable"]);
		poller.dispose();
	});

	it("does not update the viewer after disposal", async () => {
		const late = deferred<string>();
		const onState = vi.fn();
		const onUnavailable = vi.fn();
		const poller = createLiveStatePoller({ load: () => late.promise, onState, onUnavailable });
		const pending = poller.refresh();
		poller.dispose();
		late.resolve("old");
		await pending;
		expect(onState).not.toHaveBeenCalled();
		expect(onUnavailable).not.toHaveBeenCalled();
	});
});

describe("WHEP playback", () => {
	it("does not wait for old DELETE or let old tracks and cleanup replace the new stream", async () => {
		const oldDelete = deferred<Response>();
		let deleteSignal: AbortSignal | undefined;
		const requests = vi.fn((url: string, init?: RequestInit) => {
			if (init?.method === "DELETE" && url.endsWith("/old-resource")) {
				deleteSignal = init.signal ?? undefined;
				return oldDelete.promise;
			}
			return Promise.resolve(new Response("answer", { status: 201, headers: { Location: url.includes("old") ? "/old-resource" : "/new-resource" } }));
		});
		stubGlobal("fetch", requests);
		const player = createWhepPlayback({ video: video as unknown as HTMLVideoElement, onStatus: vi.fn() });
		player.connect("https://stream.test/old");
		await flush();
		peers[0]?.track(new FakeTrack("old"));
		const oldStream = video.srcObject;
		player.connect("https://stream.test/new");
		await flush();
		expect(peers[0]?.closed).toBe(true);
		peers[1]?.track(new FakeTrack("new"));
		const replacement = video.srcObject;
		expect(replacement).not.toBe(oldStream);
		peers[0]?.track(new FakeTrack("late-old"));
		peers[0]?.lateState("failed");
		expect(video.srcObject).toBe(replacement);
		vi.advanceTimersByTime(5_000);
		await flush();
		expect(deleteSignal?.aborted).toBe(true);
		expect(peers).toHaveLength(2);
		oldDelete.resolve(new Response(null, { status: 204 }));
		await flush();
		expect(video.srcObject).toBe(replacement);
		player.dispose();
	});

	it("deletes a resource returned by an obsolete WHEP request", async () => {
		const oldPost = deferred<Response>();
		const requests = vi.fn((url: string, init?: RequestInit) => {
			if (url.endsWith("/old") && init?.method === "POST") return oldPost.promise;
			if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
			return Promise.resolve(new Response("answer", { status: 201 }));
		});
		stubGlobal("fetch", requests);
		const player = createWhepPlayback({ video: video as unknown as HTMLVideoElement, onStatus: vi.fn() });
		player.connect("https://stream.test/old");
		await flush();
		player.connect("https://stream.test/new");
		await flush();
		peers[1]?.track(new FakeTrack("new"));
		const replacement = video.srcObject;
		oldPost.resolve(new Response("answer", { status: 201, headers: { Location: "/late-resource" } }));
		await flush();
		expect(requests).toHaveBeenCalledWith("https://stream.test/late-resource", expect.objectContaining({ method: "DELETE" }));
		expect(video.srcObject).toBe(replacement);
		player.dispose();
	});

	it("retries after SDP completes without any media and ignores a late track", async () => {
		const requests = vi.fn((_url: string, init?: RequestInit) => Promise.resolve(
			init?.method === "DELETE" ? new Response(null, { status: 204 })
				: new Response("answer", { status: 201, headers: { Location: "/resource" } }),
		));
		stubGlobal("fetch", requests);
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status),
			connectTimeoutMs: 1_000, retryMs: 500,
		});
		player.connect("https://stream.test/no-media");
		await flush();
		vi.advanceTimersByTime(1_000);
		await flush();
		expect(peers[0]?.closed).toBe(true);
		expect(statuses.at(-1)).toBe("failed");
		expect(requests).toHaveBeenCalledWith("https://stream.test/resource", expect.objectContaining({ method: "DELETE" }));
		peers[0]?.track(new FakeTrack("late"));
		expect(video.srcObject).toBeNull();
		vi.advanceTimersByTime(500);
		await flush();
		expect(peers).toHaveLength(2);
		player.dispose();
	});

	it("waits for a muted track to deliver media before reporting live", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status), connectTimeoutMs: 1_000,
		});
		player.connect("https://stream.test/muted");
		await flush();
		const track = new FakeTrack("muted");
		peers[0]?.track(track);
		expect(statuses.at(-1)).toBe("connecting");
		vi.advanceTimersByTime(900);
		track.unmute();
		expect(statuses.at(-1)).toBe("connecting");
		video.readyState = 2;
		video.videoWidth = 640;
		video.videoHeight = 360;
		video.emit("loadeddata");
		expect(statuses.at(-1)).toBe("live");
		vi.advanceTimersByTime(1_000);
		await flush();
		expect(peers[0]?.closed).toBe(false);
		expect(peers).toHaveLength(1);
		player.dispose();
	});

	it("times out an announced track that stays muted", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status), connectTimeoutMs: 1_000,
		});
		player.connect("https://stream.test/no-packets");
		await flush();
		const track = new FakeTrack("muted");
		peers[0]?.track(track);
		video.emit("playing");
		expect(statuses.at(-1)).toBe("connecting");
		vi.advanceTimersByTime(1_000);
		await flush();
		expect(peers[0]?.closed).toBe(true);
		expect(statuses.at(-1)).toBe("failed");
		track.lateUnmute();
		expect(statuses.at(-1)).toBe("failed");
		player.dispose();
	});

	it("retries when video packets arrive but no frame is decoded", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status),
			connectTimeoutMs: 1_000, retryMs: 500,
		});
		player.connect("https://stream.test/undecoded");
		await flush();
		const track = new FakeTrack("video");
		peers[0]?.track(track);
		track.unmute();
		expect(statuses.at(-1)).toBe("connecting");
		vi.advanceTimersByTime(1_000);
		await flush();
		expect(peers[0]?.closed).toBe(true);
		expect(statuses.at(-1)).toBe("failed");
		vi.advanceTimersByTime(500);
		await flush();
		expect(peers).toHaveLength(2);
		player.dispose();
	});

	it("does not let audio alone satisfy the first-video watchdog", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status), connectTimeoutMs: 1_000,
		});
		player.connect("https://stream.test/audio-only");
		await flush();
		const audio = new FakeTrack("audio", "audio");
		peers[0]?.track(audio);
		audio.unmute();
		video.readyState = 2;
		video.emit("loadeddata");
		expect(statuses.at(-1)).toBe("connecting");
		vi.advanceTimersByTime(1_000);
		await flush();
		expect(peers[0]?.closed).toBe(true);
		expect(statuses.at(-1)).toBe("failed");
		player.dispose();
	});

	it("waits for SDP completion even when media arrives first", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const answer = deferred<void>();
		const statuses: string[] = [];
		const player = createWhepPlayback({ video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status) });
		player.connect("https://stream.test/negotiating");
		peers[0]!.setRemoteDescription = () => answer.promise;
		await flush();
		const track = new FakeTrack("early");
		peers[0]?.track(track);
		track.unmute();
		video.readyState = 2;
		video.videoWidth = 640;
		video.videoHeight = 360;
		video.emit("playing");
		expect(statuses.at(-1)).toBe("connecting");
		answer.resolve();
		await flush();
		expect(statuses.at(-1)).toBe("live");
		player.dispose();
	});

	it("accepts loaded media but not an unmuted track announcement alone", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status), connectTimeoutMs: 1_000,
		});
		player.connect("https://stream.test/frames");
		await flush();
		const track = new FakeTrack("announced");
		track.muted = false;
		peers[0]?.track(track);
		expect(statuses.at(-1)).toBe("connecting");
		video.readyState = 2;
		video.videoWidth = 640;
		video.videoHeight = 360;
		video.emit("loadeddata");
		expect(statuses.at(-1)).toBe("live");
		player.dispose();
	});

	it("cancels the old media deadline and ignores late media after replacement or disposal", async () => {
		stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
		const statuses: string[] = [];
		const player = createWhepPlayback({
			video: video as unknown as HTMLVideoElement, onStatus: (status) => statuses.push(status), connectTimeoutMs: 1_000,
		});
		player.connect("https://stream.test/old");
		await flush();
		const old = new FakeTrack("old");
		peers[0]?.track(old);
		vi.advanceTimersByTime(700);
		player.connect("https://stream.test/new");
		await flush();
		const replacement = new FakeTrack("new");
		peers[1]?.track(replacement);
		old.lateUnmute();
		video.readyState = 2;
		video.videoWidth = 640;
		video.videoHeight = 360;
		video.history.get("loadeddata")?.[0]?.();
		expect(statuses.at(-1)).toBe("connecting");
		vi.advanceTimersByTime(300);
		await flush();
		expect(peers).toHaveLength(2);
		expect(peers[1]?.closed).toBe(false);
		replacement.unmute();
		expect(statuses.at(-1)).toBe("connecting");
		video.emit("loadeddata");
		expect(statuses.at(-1)).toBe("live");
		player.dispose();
		const statusCount = statuses.length;
		replacement.lateUnmute();
		vi.advanceTimersByTime(2_000);
		await flush();
		expect(statuses).toHaveLength(statusCount);
		expect(peers).toHaveLength(2);
	});

	it("closes a hung connection attempt and retries without affecting a replacement", async () => {
		stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
		const onStatus = vi.fn();
		const player = createWhepPlayback({ video: video as unknown as HTMLVideoElement, onStatus, connectTimeoutMs: 1_000, retryMs: 500 });
		player.connect("https://stream.test/old");
		await flush();
		vi.advanceTimersByTime(1_000);
		await flush();
		expect(peers[0]?.closed).toBe(true);
		expect(onStatus).toHaveBeenLastCalledWith("failed", "Live viewer request timed out.");
		vi.advanceTimersByTime(500);
		await flush();
		expect(peers).toHaveLength(2);
		player.dispose();
	});
});

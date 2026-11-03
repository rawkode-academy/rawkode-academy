import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

class FakeStream {
	tracks: unknown[] = [];
	addTrack(track: unknown) { this.tracks.push(track); }
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
let video: { srcObject: unknown; pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn> };

beforeEach(() => {
	vi.useFakeTimers();
	peers = [];
	video = { srcObject: null, pause: vi.fn(), play: vi.fn(async () => {}) };
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
		peers[0]?.track({ id: "old" });
		const oldStream = video.srcObject;
		player.connect("https://stream.test/new");
		await flush();
		expect(peers[0]?.closed).toBe(true);
		peers[1]?.track({ id: "new" });
		const replacement = video.srcObject;
		expect(replacement).not.toBe(oldStream);
		peers[0]?.track({ id: "late-old" });
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
		peers[1]?.track({ id: "new" });
		const replacement = video.srcObject;
		oldPost.resolve(new Response("answer", { status: 201, headers: { Location: "/late-resource" } }));
		await flush();
		expect(requests).toHaveBeenCalledWith("https://stream.test/late-resource", expect.objectContaining({ method: "DELETE" }));
		expect(video.srcObject).toBe(replacement);
		player.dispose();
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

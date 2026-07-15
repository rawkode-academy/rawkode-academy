import { afterEach, describe, expect, it, vi } from "vitest";
import { startWhipPublishing } from "./whipClient";

class FakePeerConnection {
	static current: FakePeerConnection;
	connectionState: RTCPeerConnectionState = "connected";
	iceGatheringState: RTCIceGatheringState = "complete";
	localDescription: RTCSessionDescriptionInit | null = null;
	private listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

	constructor() {
		FakePeerConnection.current = this;
	}

	addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		const listeners = this.listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}

	removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
		this.listeners.get(type)?.delete(listener);
	}

	addTrack(): void {}

	async createOffer(): Promise<RTCSessionDescriptionInit> {
		return { type: "offer", sdp: "offer-sdp" };
	}

	async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
		this.localDescription = description;
	}

	async setRemoteDescription(): Promise<void> {}

	close(): void {
		this.connectionState = "closed";
	}

	emitConnectionState(state: RTCPeerConnectionState): void {
		this.connectionState = state;
		for (const listener of this.listeners.get("connectionstatechange") ?? []) {
			if (typeof listener === "function") {
				listener(new Event("connectionstatechange"));
			} else {
				listener.handleEvent(new Event("connectionstatechange"));
			}
		}
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("startWhipPublishing", () => {
	it("reports connection changes and deletes its session exactly once", async () => {
		vi.stubGlobal(
			"RTCPeerConnection",
			FakePeerConnection as unknown as typeof RTCPeerConnection,
		);
		const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			if (init?.method === "DELETE") {
				return new Response(null, { status: 204 });
			}
			return new Response("answer-sdp", {
				status: 201,
				headers: { Location: "/session/publisher-123" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const session = await startWhipPublishing({
			publishUrl: "https://stream.example/whip/input-123",
			stream: { getTracks: () => [] } as unknown as MediaStream,
		});
		const states: RTCPeerConnectionState[] = [];
		const unsubscribe = session.onConnectionStateChange((state) => states.push(state));

		FakePeerConnection.current.emitConnectionState("disconnected");
		expect(states).toEqual(["connected", "disconnected"]);

		unsubscribe();
		await session.close();
		await session.close();

		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"https://stream.example/session/publisher-123",
			{ method: "DELETE" },
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWhipTerminalConnectionMonitor,
  isTerminalWhipConnectionState,
  startWhipPublishing,
  type WhipPublishSession,
} from "./whipClient";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("WHIP terminal connection handling", () => {
  it("classifies failed, disconnected, and closed connections as terminal", () => {
    expect(
      ([
        "new",
        "connecting",
        "connected",
        "disconnected",
        "failed",
        "closed",
      ] satisfies RTCPeerConnectionState[]).filter(isTerminalWhipConnectionState),
    ).toEqual(["disconnected", "failed", "closed"]);
  });

  it("does not handle terminal state until activated after confirmation", () => {
    const controlled = createControlledSession("connected");
    const onTerminal = vi.fn();
    const monitor = createWhipTerminalConnectionMonitor(
      controlled.session,
      onTerminal,
    );

    controlled.setState("failed");
    expect(onTerminal).not.toHaveBeenCalled();

    monitor.activate();
    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith("failed");

    controlled.setState("closed");
    expect(onTerminal).toHaveBeenCalledOnce();
  });

  it("disposes before intentional close so teardown is not reported as failure", async () => {
    const controlled = createControlledSession("connected");
    const onTerminal = vi.fn();
    const monitor = createWhipTerminalConnectionMonitor(
      controlled.session,
      onTerminal,
    );

    monitor.activate();
    monitor.dispose();
    await controlled.session.close();

    expect(onTerminal).not.toHaveBeenCalled();
  });

  it("allows a transient disconnected state to recover during its grace period", async () => {
    vi.useFakeTimers();
    const controlled = createControlledSession("connected");
    const onTerminal = vi.fn();
    const monitor = createWhipTerminalConnectionMonitor(
      controlled.session,
      onTerminal,
      { disconnectedGraceMs: 2_000 },
    );

    monitor.activate();
    controlled.setState("disconnected");
    await vi.advanceTimersByTimeAsync(1_000);
    controlled.setState("connected");
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onTerminal).not.toHaveBeenCalled();
  });

  it("reports a disconnected state that outlives its grace period", async () => {
    vi.useFakeTimers();
    const controlled = createControlledSession("connected");
    const onTerminal = vi.fn();
    const monitor = createWhipTerminalConnectionMonitor(
      controlled.session,
      onTerminal,
      { disconnectedGraceMs: 2_000 },
    );

    monitor.activate();
    controlled.setState("disconnected");
    await vi.advanceTimersByTimeAsync(2_000);

    expect(onTerminal).toHaveBeenCalledOnce();
    expect(onTerminal).toHaveBeenCalledWith("disconnected");
  });

  it("stops delivering peer connection events before closing intentionally", async () => {
    const peerConnection = installMockPeerConnection();
    const session = await startWhipPublishing({
      publishUrl: "https://stream.example.test/whip",
      stream: { getTracks: () => [] } as unknown as MediaStream,
    });
    const listener = vi.fn();
    session.onConnectionStateChange(listener);

    peerConnection.setConnectionState("disconnected");
    expect(listener).toHaveBeenCalledWith("disconnected");

    await session.close();
    expect(listener).toHaveBeenCalledOnce();
  });
});

function createControlledSession(initialState: RTCPeerConnectionState): {
  session: WhipPublishSession;
  setState: (state: RTCPeerConnectionState) => void;
} {
  let state = initialState;
  const listeners = new Set<(state: RTCPeerConnectionState) => void>();
  const setState = (nextState: RTCPeerConnectionState) => {
    state = nextState;
    for (const listener of listeners) {
      listener(state);
    }
  };

  return {
    session: {
      close: async () => setState("closed"),
      connectionState: () => state,
      onConnectionStateChange: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    setState,
  };
}

function installMockPeerConnection(): MockPeerConnection {
  const peerConnection = new MockPeerConnection();
  vi.stubGlobal("RTCPeerConnection", class {
    constructor() {
      return peerConnection;
    }
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("answer", { status: 201 })));
  return peerConnection;
}

class MockPeerConnection {
  connectionState: RTCPeerConnectionState = "connected";
  iceGatheringState: RTCIceGatheringState = "complete";
  localDescription: RTCSessionDescription | null = null;
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  addTrack(): RTCRtpSender {
    return {} as RTCRtpSender;
  }

  close(): void {
    this.setConnectionState("closed");
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { sdp: "offer", type: "offer" };
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description as RTCSessionDescription;
  }

  async setRemoteDescription(): Promise<void> {
    return undefined;
  }

  setConnectionState(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    for (const listener of this.listeners.get("connectionstatechange") ?? []) {
      listener(new Event("connectionstatechange"));
    }
  }
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWhipTerminalConnectionMonitor,
  isTerminalWhipConnectionState,
  PublisherOperationTimeoutError,
  runBoundedPublisherOperation,
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

  it("publishes each programme track with a send-only transceiver", async () => {
    const peerConnection = installMockPeerConnection();
    const audioTrack = { kind: "audio" } as MediaStreamTrack;
    const videoTrack = { kind: "video" } as MediaStreamTrack;
    const stream = { getTracks: () => [videoTrack, audioTrack] } as unknown as MediaStream;

    const session = await startWhipPublishing({
      publishUrl: "https://stream.example.test/whip",
      stream,
    });

    expect(peerConnection.transceivers).toEqual([
      { track: videoTrack, init: { direction: "sendonly", streams: [stream] } },
      { track: audioTrack, init: { direction: "sendonly", streams: [stream] } },
    ]);
    await session.close();
  });

  it("closes the peer and removes its abort listener when track registration fails", async () => {
    const peerConnection = installMockPeerConnection();
    const controller = new AbortController();
    const removeAbortListener = vi.spyOn(controller.signal, "removeEventListener");
    const registrationError = new Error("track registration failed");
    vi.spyOn(peerConnection, "addTransceiver").mockImplementation(() => {
      throw registrationError;
    });

    await expect(startWhipPublishing({
      publishUrl: "https://stream.example.test/whip",
      signal: controller.signal,
      stream: { getTracks: () => [{ kind: "audio" }] } as unknown as MediaStream,
    })).rejects.toBe(registrationError);

    expect(peerConnection.connectionState).toBe("closed");
    expect(removeAbortListener).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("deletes the WHIP resource when a session is closed", async () => {
    installMockPeerConnection();
    const requests = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "DELETE"
        ? new Response(null, { status: 204 })
        : new Response("answer", { status: 201, headers: { Location: "/sessions/123" } }),
    );
    vi.stubGlobal("fetch", requests);

    const session = await startWhipPublishing({
      publishUrl: "https://stream.example.test/whip",
      stream: { getTracks: () => [] } as unknown as MediaStream,
    });
    await session.close();
    await session.close();

    expect(requests).toHaveBeenCalledTimes(2);
    expect(requests).toHaveBeenLastCalledWith("https://stream.example.test/sessions/123", expect.objectContaining({ method: "DELETE" }));
  });

  it("closes the local peer without waiting for a hanging WHIP DELETE", async () => {
    vi.useFakeTimers();
    const peerConnection = installMockPeerConnection();
    let deleteSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        deleteSignal = init.signal ?? undefined;
        return new Promise<Response>(() => {});
      }
      return Promise.resolve(new Response("answer", { status: 201, headers: { Location: "/sessions/123" } }));
    }));

    const session = await startWhipPublishing({
      publishUrl: "https://stream.example.test/whip",
      stream: { getTracks: () => [] } as unknown as MediaStream,
    });
    await session.close();
    expect(peerConnection.connectionState).toBe("closed");
    expect(deleteSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(deleteSignal?.aborted).toBe(true);
  });

  it("deletes a WHIP resource reported after cancellation", async () => {
    const peerConnection = installMockPeerConnection();
    let finishPost!: (response: Response) => void;
    const requests = vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "DELETE"
        ? Promise.resolve(new Response(null, { status: 204 }))
        : new Promise<Response>((resolve) => { finishPost = resolve; }),
    );
    vi.stubGlobal("fetch", requests);
    const controller = new AbortController();
    const publishing = startWhipPublishing({
      publishUrl: "https://stream.example.test/whip",
      signal: controller.signal,
      stream: { getTracks: () => [] } as unknown as MediaStream,
    });
    for (let i = 0; i < 10 && !finishPost; i += 1) await Promise.resolve();
    expect(finishPost).toBeDefined();
    controller.abort();
    expect(peerConnection.connectionState).toBe("closed");
    finishPost(new Response("answer", { status: 201, headers: { Location: "/sessions/late" } }));
    await expect(publishing).rejects.toThrow("WHIP publish stopped.");
    expect(requests).toHaveBeenCalledWith("https://stream.example.test/sessions/late", expect.objectContaining({ method: "DELETE" }));
  });

  it("bounds operations even when they ignore abort and ignores their late result", async () => {
    vi.useFakeTimers();
    let resolve!: (value: string) => void;
    let operationSignal: AbortSignal | undefined;
    const pending = runBoundedPublisherOperation((signal) => {
      operationSignal = signal;
      return new Promise<string>((done) => { resolve = done; });
    }, { timeoutMs: 1_000, timeoutMessage: "Start timed out." });
    const rejected = expect(pending).rejects.toBeInstanceOf(PublisherOperationTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await rejected;
    expect(operationSignal?.aborted).toBe(true);
    resolve("late");
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts a pending operation immediately when its parent is canceled", async () => {
    const controller = new AbortController();
    let operationSignal: AbortSignal | undefined;
    const pending = runBoundedPublisherOperation((signal) => {
      operationSignal = signal;
      return new Promise<void>(() => {});
    }, { signal: controller.signal, timeoutMs: 5_000, timeoutMessage: "Timed out." });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(operationSignal?.aborted).toBe(true);
  });

  it("rejects cancellation even if an operation resolves in its abort handler", async () => {
    const controller = new AbortController();
    const pending = runBoundedPublisherOperation((signal) => new Promise<string>((resolve) => {
      signal.addEventListener("abort", () => resolve("late success"));
    }), { signal: controller.signal, timeoutMs: 5_000, timeoutMessage: "Timed out." });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
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
  readonly transceivers: Array<{
    track: MediaStreamTrack;
    init: RTCRtpTransceiverInit;
  }> = [];
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  addTransceiver(track: MediaStreamTrack, init: RTCRtpTransceiverInit): RTCRtpTransceiver {
    this.transceivers.push({ track, init });
    return {} as RTCRtpTransceiver;
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

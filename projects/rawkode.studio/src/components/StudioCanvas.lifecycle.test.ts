import { createRenderer, h, nextTick, ssrContextKey } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioLayer } from "../types";

const mocks = vi.hoisted(() => ({
  audioReady: true,
  audible: true,
  leaseLost: undefined as undefined | ((error: unknown) => Promise<void>),
  getSourceState: vi.fn(),
  resume: vi.fn(),
  startWhip: vi.fn(),
}));

vi.mock("../audio/programmeAudioMixer", () => ({
  createProgrammeAudioMixer: () => ({
    close: vi.fn(async () => {}),
    getOutputLevel: () => 0,
    getOutputTrack: () => ({ kind: "audio", readyState: "live" }),
    getSourceState: mocks.getSourceState,
    hasAudibleSource: () => mocks.audible,
    reconcile: vi.fn(),
    reconcileControls: vi.fn(),
    resume: mocks.resume,
    setSourceGain: vi.fn(),
    setSourceMuted: vi.fn(),
  }),
  requireLiveProgrammeAudioTrack: (ready: boolean, track: MediaStreamTrack, audible: boolean) => {
    if (!ready || !track || !audible) throw new Error("Programme audio is unavailable.");
    return track;
  },
}));
vi.mock("../canvas/useCanvasRenderLoop", () => ({
  useCanvasRenderLoop: () => ({ queuePaint: vi.fn(), stop: vi.fn() }),
}));
vi.mock("../recording/recordingBackup", () => ({
  appendRecordingBackupChunk: vi.fn(), closeRecordingBackup: vi.fn(),
  createRecordingBackup: vi.fn(), deleteRecordingBackup: vi.fn(),
  deleteRecordingBackupArtifact: vi.fn(), finalizeRecordingBackup: vi.fn(),
  listRecordingBackupArtifacts: vi.fn(async () => []),
  readRecordingBackupArtifact: vi.fn(), readRecordingBackupChunks: vi.fn(),
}));
vi.mock("../live/publisherLease", () => ({
  createPublisherLeaseHeartbeat: (options: { onLeaseLost: (error: unknown) => Promise<void> }) => {
    mocks.leaseLost = options.onLeaseLost;
    return { start: vi.fn(), stop: vi.fn() };
  },
}));
vi.mock("../live/whipClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("../live/whipClient")>(),
  startWhipPublishing: mocks.startWhip,
  createWhipTerminalConnectionMonitor: () => ({ activate: vi.fn(), dispose: vi.fn() }),
}));

import StudioCanvas from "./StudioCanvas.vue";

interface Node {
  type: string;
  children: Node[];
  props: Record<string, unknown>;
  parent?: Node;
  text?: string;
  captureStream?: () => FakeStream;
}

class FakeStream {
  constructor(private readonly tracks: Array<{ kind: string; readyState: string; enabled?: boolean; stop?: () => void }>) {}
  getTracks() { return this.tracks; }
  getVideoTracks() { return this.tracks.filter((track) => track.kind === "video"); }
  getAudioTracks() { return this.tracks.filter((track) => track.kind === "audio"); }
}

const capturedTracks: Array<{ kind: string; readyState: string; stop: ReturnType<typeof vi.fn> }> = [];
const node = (type: string): Node => ({ type, children: [], props: {} });
const renderer = createRenderer<Node, Node>({
  createElement(type) {
    const element = node(type);
    if (type === "canvas") element.captureStream = () => {
      const track = { kind: "video", readyState: "live", stop: vi.fn() };
      capturedTracks.push(track);
      return new FakeStream([track]);
    };
    return element;
  },
  createText(text) { return { ...node("#text"), text }; },
  createComment(text) { return { ...node("#comment"), text }; },
  setText(target, text) { target.text = text; },
  setElementText(target, text) { target.text = text; target.children = []; },
  patchProp(target, key, _previous, value) { target.props[key] = value; },
  insert(child, parent, anchor) {
    if (child.parent) {
      const oldIndex = child.parent.children.indexOf(child);
      if (oldIndex >= 0) child.parent.children.splice(oldIndex, 1);
    }
    child.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
  },
  remove(child) {
    if (!child.parent) return;
    const index = child.parent.children.indexOf(child);
    if (index >= 0) child.parent.children.splice(index, 1);
    child.parent = undefined;
  },
  parentNode(child) { return child.parent ?? null; },
  nextSibling(child) {
    if (!child.parent) return null;
    return child.parent.children[child.parent.children.indexOf(child) + 1] ?? null;
  },
  insertStaticContent(content, parent, anchor) {
    const child = { ...node("#static"), text: content, parent };
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    return [child, child];
  },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function textContent(target: Node): string {
  return `${target.text ?? ""}${target.children.map(textContent).join("")}`;
}

function findButton(root: Node, label: string): Node | undefined {
  if (root.type === "button" && textContent(root).trim() === label) return root;
  for (const child of root.children) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return undefined;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 100; i += 1) await Promise.resolve();
  await nextTick();
}

function click(root: Node, label: string): void {
  const button = findButton(root, label);
  expect(button, `button ${label}`).toBeDefined();
  (button?.props.onClick as () => void)();
}

function mount(
  streamStatus = "idle",
  takeoverLease: string | null = null,
  media: { layers?: StudioLayer[]; mediaStreams?: Map<string, MediaStream>; requiredProgrammeAudioSourceIds?: string[] } = {},
) {
  const root = node("root");
  // Vitest loads the SFC through Vite's SSR transform. Supply a small client
  // render function that exercises the component's real setup and handlers.
  const component = {
    ...StudioCanvas,
    render(this: { $: { setupState: Record<string, unknown> } }) {
      const state = this.$.setupState;
      return h("div", [
        h("canvas", { ref: "canvasElement" }),
        h("button", { onClick: state.toggleLivePublishing, disabled: state.liveButtonDisabled }, String(state.liveButtonLabel)),
        h("span", String(state.liveStatusText)),
      ]);
    },
  };
  const app = renderer.createApp(component, {
    title: "Programme", layers: [], isPlaying: true, isRecording: false, ...media,
    resolution: { width: 1920, height: 1080, fps: 30 },
    sessionId: "session-1", canPublishLive: true, streamEnvironment: "test", streamStatus, takeoverLease,
  });
  app.provide(ssrContextKey, { modules: new Set() });
  app.mount(root);
  return { app, root };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let storage: Map<string, string>;
let requests: Array<{ action: string; streamToken?: string; expectedTakeoverLease?: string }>;
let handleRequest: (action: string, streamToken?: string, expectedTakeoverLease?: string) => Promise<Response>;

beforeEach(() => {
  vi.useFakeTimers();
  capturedTracks.length = 0;
  mocks.audioReady = true;
  mocks.audible = true;
  mocks.leaseLost = undefined;
  mocks.getSourceState.mockReset();
  mocks.getSourceState.mockReturnValue({ active: true, gain: 1, muted: false, trackCount: 1 });
  mocks.resume.mockReset();
  mocks.resume.mockImplementation(() => Promise.resolve(mocks.audioReady));
  mocks.startWhip.mockReset();
  mocks.startWhip.mockResolvedValue({ close: vi.fn(async () => {}), connectionState: () => "connected" });
  storage = new Map();
  requests = [];
  handleRequest = async (action, streamToken) => response(
    action === "start" ? { streamToken, publishUrl: "https://stream.example/whip" }
      : action === "heartbeat" ? { leaseStatus: "active" }
      : action === "stop" ? { cancellationRecorded: true, providerRevocation: "revoked" }
      : action === "confirm" ? { streamStatus: "live", notified: false }
      : {},
  );
  const sessionStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  };
  vi.stubGlobal("window", {
    sessionStorage, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    setInterval, clearInterval, setTimeout, clearTimeout,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    createElement: () => ({ srcObject: null, readyState: 2, videoWidth: 320, videoHeight: 180, play: vi.fn(async () => {}), pause: vi.fn() }),
  });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("MediaStream", FakeStream);
  vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("publisher-token") });
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    const { action, streamToken, expectedTakeoverLease } = init.method === "POST"
      ? JSON.parse(String(init.body))
      : Object.fromEntries(new URL(url, "https://studio.example").searchParams);
    requests.push({ action, streamToken, ...(expectedTakeoverLease === undefined ? {} : { expectedTakeoverLease }) });
    return await handleRequest(action, streamToken, expectedTakeoverLease);
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Studio publisher lifecycle", () => {
  it("cancels a hanging start by exact token and ignores the late response", async () => {
    const start = deferred<Response>();
    handleRequest = async (action) => action === "start" ? start.promise
      : response(action === "stop" ? { cancellationRecorded: true, providerRevocation: "revoked" } : { leaseStatus: "active" });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    expect(requests).toEqual([{ action: "start", streamToken: "publisher-token" }]);
    click(root, "Cancel live start");
    await flush();
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    expect(storage.size).toBe(0);
    start.resolve(response({ streamToken: "publisher-token", publishUrl: "https://stream.example/whip" }));
    await flush();
    expect(mocks.startWhip).not.toHaveBeenCalled();
    app.unmount();
  });

  it("retains an unconfirmed stop and retries only the same token", async () => {
    const start = deferred<Response>();
    const stop = deferred<Response>();
    let stops = 0;
    handleRequest = async (action) => action === "start" ? start.promise
      : action === "stop" && stops++ === 0 ? stop.promise
      : response({ cancellationRecorded: true, providerRevocation: "revoked" });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    click(root, "Cancel live start");
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    expect(findButton(root, "Retry stop")).toBeDefined();
    expect([...storage.values()]).toEqual(["publisher-token"]);
    click(root, "Retry stop");
    await flush();
    expect(requests.filter((request) => request.action === "stop")).toEqual([
      { action: "stop", streamToken: "publisher-token" },
      { action: "stop", streamToken: "publisher-token" },
    ]);
    expect(storage.size).toBe(0);
    stop.resolve(response({ cancellationRecorded: true, providerRevocation: "revoked" }));
    app.unmount();
  });

  it("retains the exact token until provider retirement is confirmed", async () => {
    let retired = false;
    handleRequest = async (action, token) => response(
      action === "start" ? { streamToken: token, publishUrl: "https://stream.example/whip" }
        : action === "heartbeat" ? { leaseStatus: "active" }
        : action === "stop" ? { cancellationRecorded: true, providerRevocation: retired ? "revoked" : "pending" }
        : { streamStatus: "live" },
    );
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    click(root, "Stop live");
    await flush();
    expect(findButton(root, "Retry stop")).toBeDefined();
    expect([...storage.values()]).toEqual(["publisher-token"]);
    expect(requests.filter((request) => request.action === "start")).toHaveLength(1);
    retired = true;
    click(root, "Retry stop");
    await flush();
    expect(storage.size).toBe(0);
    expect(requests.filter((request) => request.action === "stop").every(
      (request) => request.streamToken === "publisher-token",
    )).toBe(true);
    app.unmount();
  });

  it("recovers an unconfirmed stop on reload and requires an explicit cancellation acknowledgement", async () => {
    const stop = deferred<Response>();
    let acknowledge = false;
    handleRequest = async (action) => action === "start" ? new Promise<Response>(() => {})
      : action === "stop" && !acknowledge ? stop.promise
      : response(acknowledge ? { cancellationRecorded: true, providerRevocation: "revoked" } : { streamStatus: "ended" });
    const first = mount();
    await flush();
    click(first.root, "Go live");
    await flush();
    click(first.root, "Cancel live start");
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    first.app.unmount();

    const restored = mount();
    await flush();
    expect(findButton(restored.root, "Retry stop")).toBeDefined();
    // An HTTP success without the durable tombstone is not confirmation.
    handleRequest = async () => response({ streamStatus: "ended" });
    click(restored.root, "Retry stop");
    await flush();
    expect(findButton(restored.root, "Retry stop")).toBeDefined();
    expect([...storage.values()]).toEqual(["publisher-token"]);

    acknowledge = true;
    handleRequest = async () => response({ cancellationRecorded: true, providerRevocation: "revoked" });
    click(restored.root, "Retry stop");
    await flush();
    expect(storage.size).toBe(0);
    expect(requests.filter((request) => request.action === "stop").every(
      (request) => request.streamToken === "publisher-token",
    )).toBe(true);
    stop.resolve(response({ cancellationRecorded: true, providerRevocation: "revoked" }));
    restored.app.unmount();
  });

  it("does not cancel a restored token automatically when the tab closes", async () => {
    // Browsers can copy sessionStorage when a tab is opened from another tab.
    storage.set("rawkode-studio-publisher:session-1:token", "publisher-token");
    const { app, root } = mount();
    await flush();
    expect(findButton(root, "Retry stop")).toBeDefined();
    expect(textContent(root)).toContain("may belong to another open tab");
    app.unmount();
    await flush();
    expect(requests).toEqual([]);
    expect([...storage.values()]).toEqual(["publisher-token"]);
  });

  it("continues to surface an uncertain takeover after a restored token is cancelled", async () => {
    storage.set("rawkode-studio-publisher:session-1:token", "publisher-token");
    storage.set("rawkode-studio-publisher:session-1:takeover", "pending");
    const { app, root } = mount();
    await flush();
    click(root, "Retry stop");
    await flush();
    expect(textContent(root)).toContain("Takeover status is unconfirmed");
    expect(findButton(root, "Takeover unconfirmed")?.props.disabled).toBe(true);
    app.unmount();
  });

  it("waits for a fresh acknowledged lease before creating a WHIP publisher", async () => {
    const heartbeat = deferred<Response>();
    handleRequest = async (action, token) => action === "heartbeat" ? heartbeat.promise
      : response(action === "start" ? { streamToken: token, publishUrl: "https://stream.example/whip" }
        : action === "stop" ? { cancellationRecorded: true, providerRevocation: "revoked" }
        : { streamStatus: "live" });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    expect(mocks.startWhip).not.toHaveBeenCalled();
    heartbeat.resolve(response({ leaseStatus: "active" }));
    await flush();
    expect(mocks.startWhip).toHaveBeenCalledOnce();
    app.unmount();
  });

  it("cancels the exact token if the fresh lease acknowledgement times out", async () => {
    const heartbeat = deferred<Response>();
    handleRequest = async (action, token) => action === "heartbeat" ? heartbeat.promise
      : response(action === "start" ? { streamToken: token, publishUrl: "https://stream.example/whip" }
        : { cancellationRecorded: true, providerRevocation: "revoked" });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    await vi.advanceTimersByTimeAsync(4_000);
    await flush();
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    expect(storage.size).toBe(0);
    heartbeat.resolve(response({ leaseStatus: "active" }));
    await flush();
    expect(mocks.startWhip).not.toHaveBeenCalled();
    app.unmount();
  });

  it("compensates a timed-out start with the original token", async () => {
    const start = deferred<Response>();
    handleRequest = async (action) => action === "start" ? start.promise
      : response({ cancellationRecorded: true, providerRevocation: "revoked" });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    expect(storage.size).toBe(0);
    expect(textContent(root)).toContain("start request timed out");
    expect(mocks.startWhip).not.toHaveBeenCalled();
    app.unmount();
  });

  it("times out WHIP startup, releases video, and confirms cancellation", async () => {
    mocks.startWhip.mockReturnValue(new Promise(() => {}));
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    expect(capturedTracks, JSON.stringify({ requests, text: textContent(root) })).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    expect(capturedTracks[0]?.stop).toHaveBeenCalled();
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    expect(storage.size).toBe(0);
    expect(textContent(root)).toContain("WHIP publishing timed out");
    app.unmount();
  });

  it("closes a WHIP session completed after its deadline before the timeout callback runs", async () => {
    const whip = deferred<{ close: () => Promise<void>; connectionState: () => "connected" }>();
    const close = vi.fn(async () => {});
    mocks.startWhip.mockReturnValue(whip.promise);
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    expect(mocks.startWhip).toHaveBeenCalledOnce();
    now.mockReturnValue(15_001);
    whip.resolve({ close, connectionState: () => "connected" });
    await flush();
    expect(close).toHaveBeenCalled();
    expect(capturedTracks[0]?.stop).toHaveBeenCalled();
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    expect(textContent(root)).toContain("WHIP publishing timed out");
    now.mockRestore();
    app.unmount();
  });

  it("does not let a slow old close stop a replacement publisher's video", async () => {
    const oldClose = deferred<void>();
    mocks.startWhip.mockReset();
    mocks.startWhip
      .mockResolvedValueOnce({ close: () => oldClose.promise, connectionState: () => "connected" })
      .mockResolvedValueOnce({ close: vi.fn(async () => {}), connectionState: () => "connected" });
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("old-token").mockReturnValueOnce("new-token") });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    expect(findButton(root, "Stop live"), JSON.stringify({ requests, text: textContent(root) })).toBeDefined();
    const loseLease = mocks.leaseLost;
    expect(loseLease).toBeDefined();
    void loseLease?.(new Error("heartbeat lost"));
    await flush();
    expect(capturedTracks[0]?.stop).toHaveBeenCalled();
    expect(requests).toContainEqual({ action: "stop", streamToken: "old-token" });
    click(root, "Go live");
    await flush();
    expect(capturedTracks).toHaveLength(2);
    expect(capturedTracks[1]?.stop).not.toHaveBeenCalled();
    oldClose.resolve();
    await flush();
    expect(capturedTracks[1]?.stop).not.toHaveBeenCalled();
    app.unmount();
  });

  it("does not let stale media setup discard the replacement publisher's track ownership", async () => {
    const oldAudio = deferred<boolean>();
    mocks.resume.mockReset();
    mocks.resume
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(oldAudio.promise)
      .mockResolvedValue(true);
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValueOnce("old-token").mockReturnValueOnce("new-token") });
    const { app, root } = mount();
    await flush();
    click(root, "Go live");
    await flush();
    expect(capturedTracks).toHaveLength(1);
    void mocks.leaseLost?.(new Error("heartbeat lost"));
    await flush();
    click(root, "Go live");
    await flush();
    expect(capturedTracks).toHaveLength(2);
    oldAudio.resolve(false);
    await flush();
    click(root, "Stop live");
    await flush();
    expect(capturedTracks[1]?.stop).toHaveBeenCalled();
    expect(requests).toContainEqual({ action: "stop", streamToken: "new-token" });
    app.unmount();
  });

  it("can stop without standby media and never retries an ambiguous takeover", async () => {
    const takeover = deferred<Response>();
    handleRequest = async (action) => action === "takeover" ? takeover.promise : response({ cancellationRecorded: true, providerRevocation: "revoked" });
    mocks.audible = false;
    const { app, root } = mount("live", "observed-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    expect(requests.filter((request) => request.action === "takeover")).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10_000);
    await flush();
    expect(textContent(root)).toContain("Takeover status is unconfirmed");
    expect(findButton(root, "Check takeover")?.props.disabled).toBe(false);
    click(root, "Check takeover");
    await flush();
    expect(requests.filter((request) => request.action === "takeover")).toHaveLength(1);
    app.unmount();
    const restored = mount("live", "observed-lease");
    await flush();
    expect(textContent(restored.root)).toContain("Takeover status is unconfirmed");
    expect(findButton(restored.root, "Check takeover")?.props.disabled).toBe(false);
    takeover.resolve(response({ streamStatus: "ended", providerRevocation: "revoked" }));
    restored.app.unmount();
  });

  it("allows stop but blocks a replacement when programme media is absent in the standby tab", async () => {
    const layers: StudioLayer[] = [{
      id: "camera", name: "Producer camera", type: "camera", sourceId: "publisher-camera",
      enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 },
    }];
    const standby = new FakeStream([{ kind: "video", readyState: "live", enabled: true }]) as unknown as MediaStream;
    const { app, root } = mount("live", "old-lease", {
      layers, mediaStreams: new Map([["standby-camera", standby]]),
      requiredProgrammeAudioSourceIds: ["publisher-camera"],
    });
    handleRequest = async () => response({ streamStatus: "ended", providerRevocation: "revoked" });
    await flush();
    click(root, "Stop current publisher");
    await flush();
    expect(requests.some((request) => request.action === "takeover")).toBe(true);
    click(root, "Go live");
    await flush();
    expect(textContent(root)).toContain("Programme media is unavailable");
    expect(requests.some((request) => request.action === "start")).toBe(false);
    app.unmount();
  });

  it("rechecks programme media after asynchronous setup before dispatching start", async () => {
    const ready = deferred<boolean>();
    mocks.resume.mockReturnValue(ready.promise);
    const track = { kind: "video", readyState: "live", enabled: true };
    const stream = new FakeStream([track]) as unknown as MediaStream;
    const layers: StudioLayer[] = [{
      id: "camera", name: "Camera", type: "camera", sourceId: "camera-a",
      enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 },
    }];
    const { app, root } = mount("idle", null, { layers, mediaStreams: new Map([["camera-a", stream]]) });
    await flush();
    click(root, "Go live");
    await flush();
    track.enabled = false;
    ready.resolve(true);
    await flush();
    expect(textContent(root)).toContain("Programme media changed before publishing");
    expect(requests.some((request) => request.action === "start")).toBe(false);
    app.unmount();
  });

  it("does not start a replacement if programme media disappears after takeover", async () => {
    handleRequest = async () => response({ streamStatus: "ended", providerRevocation: "revoked" });
    const track = { kind: "video", readyState: "live", enabled: true };
    const stream = new FakeStream([track]) as unknown as MediaStream;
    const layers: StudioLayer[] = [{
      id: "camera", name: "Camera", type: "camera", sourceId: "camera-a",
      enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 },
    }];
    const { app, root } = mount("live", "old-lease", { layers, mediaStreams: new Map([["camera-a", stream]]) });
    await flush();
    click(root, "Stop current publisher");
    await flush();
    track.enabled = false;
    click(root, "Go live");
    await flush();
    expect(textContent(root)).toContain("Programme media is unavailable");
    expect(requests.some((request) => request.action === "start")).toBe(false);
    app.unmount();
  });

  it("does not start when one required audio input failed to join the mix", async () => {
    mocks.getSourceState.mockImplementation((sourceId: string) => ({
      active: sourceId === "audio-a", gain: 1, muted: false, trackCount: sourceId === "audio-a" ? 1 : 0,
    }));
    const audio = () => new FakeStream([{ kind: "audio", readyState: "live", enabled: true }]) as unknown as MediaStream;
    const { app, root } = mount("idle", null, {
      mediaStreams: new Map([["audio-a", audio()], ["audio-b", audio()]]),
      requiredProgrammeAudioSourceIds: ["audio-a", "audio-b"],
    });
    await flush();
    click(root, "Go live");
    await flush();
    expect(textContent(root)).toContain("Programme media changed before publishing");
    expect(requests.some((request) => request.action === "start")).toBe(false);
    app.unmount();
  });

  it("cancels before confirming if programme media disappears during WHIP setup", async () => {
    const whip = deferred<{ close: () => Promise<void>; connectionState: () => "connected" }>();
    mocks.startWhip.mockReturnValue(whip.promise);
    const track = { kind: "video", readyState: "live", enabled: true };
    const stream = new FakeStream([track]) as unknown as MediaStream;
    const layers: StudioLayer[] = [{
      id: "camera", name: "Camera", type: "camera", sourceId: "camera-a",
      enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 },
    }];
    const { app, root } = mount("idle", null, { layers, mediaStreams: new Map([["camera-a", stream]]) });
    await flush();
    click(root, "Go live");
    await flush();
    track.enabled = false;
    whip.resolve({ close: vi.fn(async () => {}), connectionState: () => "connected" });
    await flush();
    expect(requests.some((request) => request.action === "confirm")).toBe(false);
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    app.unmount();
  });

  it("stops if programme media disappears while confirmation is in flight", async () => {
    const confirm = deferred<Response>();
    handleRequest = async (action, token) => action === "confirm" ? confirm.promise
      : response(action === "start" ? { streamToken: token, publishUrl: "https://stream.example/whip" }
        : action === "heartbeat" ? { leaseStatus: "active" }
        : { cancellationRecorded: true, providerRevocation: "revoked" });
    const track = { kind: "video", readyState: "live", enabled: true };
    const stream = new FakeStream([track]) as unknown as MediaStream;
    const layers: StudioLayer[] = [{
      id: "camera", name: "Camera", type: "camera", sourceId: "camera-a",
      enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 },
    }];
    const { app, root } = mount("idle", null, { layers, mediaStreams: new Map([["camera-a", stream]]) });
    await flush();
    click(root, "Go live");
    await flush();
    expect(requests.some((request) => request.action === "confirm")).toBe(true);
    track.enabled = false;
    confirm.resolve(response({ streamStatus: "live" }));
    await flush();
    expect(requests).toContainEqual({ action: "stop", streamToken: "publisher-token" });
    expect(textContent(root)).toContain("Programme media changed during confirmation");
    app.unmount();
  });

  it("does not issue takeover without an observed publisher identity", async () => {
    const { app, root } = mount("live");
    await flush();
    expect(findButton(root, "Refresh to take over")?.props.disabled).toBe(true);
    click(root, "Refresh to take over");
    await flush();
    expect(requests).toEqual([]);
    app.unmount();
  });

  it("sends the originally observed lease and preserves a replacement when takeover is delayed", async () => {
    const arrival = deferred<void>();
    let currentLease = "old-lease";
    handleRequest = async (action, _token, expected) => {
      if (action !== "takeover") return response({ cancellationRecorded: true, providerRevocation: "revoked" });
      await arrival.promise;
      if (expected !== currentLease) {
        return response({ code: "takeover-precondition-failed", error: "Publisher changed." }, 409);
      }
      currentLease = "ended";
      return response({ streamStatus: "ended", providerRevocation: "revoked" });
    };
    const { app, root } = mount("live", "old-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    expect(requests).toContainEqual({ action: "takeover", streamToken: undefined, expectedTakeoverLease: "old-lease" });
    currentLease = "replacement-lease";
    arrival.resolve();
    await flush();
    expect(currentLease).toBe("replacement-lease");
    expect(textContent(root)).toContain("publisher changed");
    expect(findButton(root, "Refresh to take over")?.props.disabled).toBe(true);
    expect(storage.size).toBe(0);
    expect(requests.filter((request) => request.action === "takeover")).toHaveLength(1);
    app.unmount();
  });

  it("waits for an explicit start after the observed publisher is stopped", async () => {
    handleRequest = async (action, token) => response(
      action === "takeover" ? { streamStatus: "ended", providerRevocation: "revoked" }
        : action === "start" ? { streamToken: token, publishUrl: "https://stream.example/whip" }
        : action === "heartbeat" ? { leaseStatus: "active" }
        : action === "confirm" ? { streamStatus: "live" }
        : { cancellationRecorded: true, providerRevocation: "revoked" },
    );
    const { app, root } = mount("live", "old-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    expect(requests.some((request) => request.action === "start")).toBe(false);
    click(root, "Go live");
    await flush();
    expect(requests).toContainEqual({ action: "takeover", streamToken: undefined, expectedTakeoverLease: "old-lease" });
    expect(requests).toContainEqual({ action: "start", streamToken: "publisher-token" });
    expect(mocks.startWhip).toHaveBeenCalledOnce();
    expect(findButton(root, "Stop live")).toBeDefined();
    app.unmount();
  });

  it("treats a takeover response without acknowledgement as unconfirmed", async () => {
    handleRequest = async () => response({});
    const { app, root } = mount("live", "old-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    expect(textContent(root)).toContain("Takeover status is unconfirmed");
    expect([...storage.values()]).toEqual([JSON.stringify({ expectedTakeoverLease: "old-lease" })]);
    expect(requests.filter((request) => request.action === "takeover")).toHaveLength(1);
    app.unmount();
  });

  it("does not start a replacement while takeover retirement is pending", async () => {
    handleRequest = async () => response({ streamStatus: "ended", providerRevocation: "pending" });
    const { app, root } = mount("live", "old-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    await vi.advanceTimersByTimeAsync(6_000);
    await flush();
    expect(textContent(root)).toContain("Takeover status is unconfirmed");
    expect([...storage.values()]).toEqual([JSON.stringify({ expectedTakeoverLease: "old-lease" })]);
    expect(requests.some((request) => request.action === "start")).toBe(false);
    app.unmount();
  });

  it("checks the original takeover until revocation is confirmed without starting automatically", async () => {
    let takeoverState = "pending";
    handleRequest = async (action) => response(action === "takeover"
      ? { streamStatus: "ended", providerRevocation: "pending" }
      : { takeoverState });
    const { app, root } = mount("live", "old-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    click(root, "Check takeover");
    await flush();
    expect(textContent(root)).toContain("still being disconnected");
    expect([...storage.values()]).toEqual([JSON.stringify({ expectedTakeoverLease: "old-lease" })]);
    takeoverState = "revoked";
    click(root, "Check takeover");
    await flush();
    expect(findButton(root, "Go live")?.props.disabled).toBe(false);
    expect(storage.size).toBe(0);
    expect(requests.filter((request) => request.action === "takeover-status")).toEqual([
      { action: "takeover-status", streamToken: undefined, expectedTakeoverLease: "old-lease" },
      { action: "takeover-status", streamToken: undefined, expectedTakeoverLease: "old-lease" },
    ]);
    expect(requests.some((request) => request.action === "start")).toBe(false);
    app.unmount();
  });

  it("keeps an unknown recovery blocked and restores the original observation after reload", async () => {
    storage.set("rawkode-studio-publisher:session-1:takeover", JSON.stringify({ expectedTakeoverLease: "old-lease" }));
    handleRequest = async () => response({ takeoverState: "unknown" });
    const { app, root } = mount("ended");
    await flush();
    click(root, "Check takeover");
    await flush();
    expect(textContent(root)).toContain("Takeover status is unknown");
    expect(findButton(root, "Check takeover")?.props.disabled).toBe(false);
    expect([...storage.values()]).toEqual([JSON.stringify({ expectedTakeoverLease: "old-lease" })]);
    expect(requests).toContainEqual({ action: "takeover-status", streamToken: undefined, expectedTakeoverLease: "old-lease" });
    app.unmount();
  });

  it("keeps an active observation blocked because the earlier takeover may still arrive", async () => {
    handleRequest = async (action) => action === "takeover"
      ? response({ error: "unavailable" }, 503)
      : response({ takeoverState: "active" });
    const { app, root } = mount("live", "old-lease");
    await flush();
    click(root, "Stop current publisher");
    await flush();
    click(root, "Check takeover");
    await flush();
    expect(findButton(root, "Check takeover")?.props.disabled).toBe(false);
    expect(textContent(root)).toContain("takeover request may still arrive");
    expect(storage.size).toBe(1);
    expect(requests.filter((request) => request.action === "takeover")).toHaveLength(1);
    app.unmount();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContributorLocalIsoStore,
  getContributorLocalIsoMediaSignature,
  resolveContributorLocalIsoOutcome,
  startContributorLocalIsoRecording,
} from "./contributorLocalIso";

class FakeTrack extends EventTarget {
  enabled = true;
  readonly id = crypto.randomUUID();
  readyState: MediaStreamTrack["readyState"] = "live";
  stopCalls = 0;
  constructor(readonly kind: MediaStreamTrack["kind"]) { super(); }
  clone(): FakeTrack { return new FakeTrack(this.kind); }
  stop(): void { this.stopCalls += 1; this.readyState = "ended"; this.dispatchEvent(new Event("ended")); }
  getSettings(): MediaTrackSettings { return this.kind === "video" ? { width: 1280, height: 720 } : { sampleRate: 48_000 }; }
}

class FakeStream {
  constructor(readonly tracks: FakeTrack[]) {}
  getTracks(): FakeTrack[] { return this.tracks; }
  getAudioTracks(): FakeTrack[] { return this.tracks.filter((track) => track.kind === "audio"); }
  getVideoTracks(): FakeTrack[] { return this.tracks.filter((track) => track.kind === "video"); }
}

class FakeRecorder extends EventTarget {
  static instances: FakeRecorder[] = [];
  static failStart = false;
  static isTypeSupported(): boolean { return true; }
  state: RecordingState = "inactive";
  pause = vi.fn();
  requestData = vi.fn();
  startCalls = 0;
  stopCalls = 0;
  private dataListener?: (event: BlobEvent) => void;
  constructor(readonly stream: FakeStream, _options: MediaRecorderOptions) { super(); FakeRecorder.instances.push(this); }
  start(): void { this.startCalls += 1; if (FakeRecorder.failStart) throw new Error("start failed"); this.state = "recording"; }
  stop(): void { this.stopCalls += 1; this.state = "inactive"; this.emitData(new Blob(["final"])); this.dispatchEvent(new Event("stop")); }
  emitData(data: Blob): void { this.dataListener?.({ data } as BlobEvent); }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void {
    if (type === "dataavailable" && typeof listener === "function") this.dataListener = listener as (event: BlobEvent) => void;
    super.addEventListener(type, listener, options);
  }
}

function setBrowserFakes(): void {
  FakeRecorder.instances = [];
  FakeRecorder.failStart = false;
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("MediaStream", FakeStream);
  vi.stubGlobal("window", { clearInterval: vi.fn(), setInterval: vi.fn(() => 1) });
}

function media(): { audio: FakeTrack; stream: MediaStream; video: FakeTrack } {
  const audio = new FakeTrack("audio");
  const video = new FakeTrack("video");
  return { audio, stream: new FakeStream([video, audio]) as unknown as MediaStream, video };
}

function mockStore(appendChunk = vi.fn(async () => undefined)) {
  const calls: string[] = [];
  const store = {
    appendChunk: vi.fn(async (...args: Parameters<typeof appendChunk>) => { calls.push("chunk"); return await appendChunk(...args); }),
    close: vi.fn(() => calls.push("close")),
    saveManifest: vi.fn(async (manifest: { status: string }) => calls.push(`manifest:${manifest.status}`)),
  };
  vi.spyOn(ContributorLocalIsoStore, "open").mockResolvedValue(store as unknown as ContributorLocalIsoStore);
  return { calls, store };
}

afterEach(() => vi.unstubAllGlobals());

describe("contributor local ISO recording", () => {

  it("keeps an equivalent stream wrapper but detects a muted or replaced capture track", () => {
    const { stream, video } = media();
    const equivalentWrapper = new FakeStream([video, stream.getAudioTracks()[0]! as unknown as FakeTrack]) as unknown as MediaStream;
    const initialSignature = getContributorLocalIsoMediaSignature(stream);
    expect(getContributorLocalIsoMediaSignature(equivalentWrapper)).toBe(initialSignature);

    video.enabled = false;
    expect(getContributorLocalIsoMediaSignature(stream)).not.toBe(initialSignature);
  });
  it("never marks a capture complete when a source track ends early", () => {
    expect(resolveContributorLocalIsoOutcome(true, false)).toBe("failed");
  });

  it("persists the final chunk before the complete manifest and never pauses capture", async () => {
    setBrowserFakes();
    const { calls, store } = mockStore();
    const { stream } = media();
    const active = await startContributorLocalIsoRecording({ mediaStream: stream, participantId: "guest", sessionId: "session" });

    await active.stop();

    expect(calls).toEqual(["manifest:recording", "chunk", "manifest:complete", "close"]);
    expect(FakeRecorder.instances[0]?.pause).not.toHaveBeenCalled();
    expect(store.appendChunk).toHaveBeenCalledTimes(1);
  });

  it("finalizes as failed when a cloned capture track ends and never stops the source track", async () => {
    setBrowserFakes();
    const { store } = mockStore();
    const { stream, video } = media();
    const active = await startContributorLocalIsoRecording({ mediaStream: stream, participantId: "guest", sessionId: "session" });

    FakeRecorder.instances[0]?.stream.getVideoTracks()[0]?.dispatchEvent(new Event("ended"));
    const result = await active.finished;

    expect(result.status).toBe("failed");
    expect(video.stopCalls).toBe(0);
    expect(store.saveManifest).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("fails safely when a cloned track ends while the initial manifest write is pending", async () => {
    setBrowserFakes();
    const { store } = mockStore();
    store.saveManifest.mockImplementationOnce(async () => {
      FakeRecorder.instances[0]?.stream.getVideoTracks()[0]?.dispatchEvent(new Event("ended"));
      return 0;
    });

    await expect(startContributorLocalIsoRecording({ mediaStream: media().stream, participantId: "guest", sessionId: "session" }))
      .rejects.toThrow("ended before local recording could start");

    expect(FakeRecorder.instances[0]?.startCalls).toBe(0);
    expect(FakeRecorder.instances[0]?.stopCalls).toBe(0);
    expect(store.saveManifest).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed" }));
  });

  it("marks a persisted manifest failed when the browser recorder cannot start", async () => {
    setBrowserFakes();
    const { store } = mockStore();
    FakeRecorder.failStart = true;

    await expect(startContributorLocalIsoRecording({ mediaStream: media().stream, participantId: "guest", sessionId: "session" }))
      .rejects.toThrow("start failed");

    expect(store.saveManifest).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed", failureReason: "start failed" }));
  });

  it("keeps the partial recording recoverable when chunk storage fails", async () => {
    setBrowserFakes();
    const { store } = mockStore(vi.fn(async () => { throw new Error("quota"); }));
    const { stream } = media();
    const active = await startContributorLocalIsoRecording({ mediaStream: stream, participantId: "guest", sessionId: "session" });
    FakeRecorder.instances[0]?.emitData(new Blob(["partial"]));

    const result = await active.finished;

    expect(result.status).toBe("failed");
    expect(store.saveManifest).toHaveBeenLastCalledWith(expect.objectContaining({ status: "failed", failureReason: "quota" }));
  });
});

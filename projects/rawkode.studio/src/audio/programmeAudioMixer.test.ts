import { describe, expect, it } from "vitest";
import {
  createProgrammeAudioMixer,
  requireLiveProgrammeAudioTrack,
} from "./programmeAudioMixer";

class FakeTrack {
  readonly kind = "audio";
  readyState: MediaStreamTrackState = "live";
  stopped = false;
  private readonly endedListeners = new Set<EventListener>();

  constructor(readonly id: string) {}

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "ended" && typeof listener === "function") {
      this.endedListeners.add(listener);
    }
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "ended" && typeof listener === "function") {
      this.endedListeners.delete(listener);
    }
  }

  stop(): void {
    this.stopped = true;
    this.end();
  }

  end(): void {
    if (this.readyState === "ended") return;
    this.readyState = "ended";
    for (const listener of [...this.endedListeners]) {
      listener(new Event("ended"));
    }
  }

  get listenerCount(): number {
    return this.endedListeners.size;
  }
}

class FakeMediaStream {
  constructor(readonly tracks: FakeTrack[]) {}

  getAudioTracks(): FakeTrack[] {
    return this.tracks.filter((track) => track.kind === "audio");
  }

  getTracks(): FakeTrack[] {
    return [...this.tracks];
  }
}

class FakeAudioNode {
  disconnectCount = 0;
  readonly connections: unknown[] = [];

  connect(destination: unknown): unknown {
    this.connections.push(destination);
    return destination;
  }

  disconnect(): void {
    this.disconnectCount += 1;
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = { value: 1 };
}

class FakeAnalyserNode extends FakeAudioNode {
  fftSize = 2048;
  samples: number[] = [];

  getFloatTimeDomainData(target: Float32Array): void {
    target.fill(0);
    target.set(this.samples.slice(0, target.length));
  }
}

class FakeSourceNode extends FakeAudioNode {
  constructor(readonly stream: FakeMediaStream) {
    super();
  }
}

class FakeDestinationNode extends FakeAudioNode {
  readonly stream: FakeMediaStream;

  constructor(readonly outputTrack: FakeTrack) {
    super();
    this.stream = new FakeMediaStream([outputTrack]);
  }
}

class FakeAudioContext {
  state: AudioContextState = "suspended";
  readonly outputTrack = new FakeTrack("programme-output");
  readonly destination = new FakeDestinationNode(this.outputTrack);
  readonly analyser = new FakeAnalyserNode();
  readonly gainNodes: FakeGainNode[] = [];
  readonly sourceNodes: FakeSourceNode[] = [];
  resumeCount = 0;
  closeCount = 0;

  createAnalyser(): AnalyserNode {
    return this.analyser as unknown as AnalyserNode;
  }

  createGain(): GainNode {
    const node = new FakeGainNode();
    this.gainNodes.push(node);
    return node as unknown as GainNode;
  }

  createMediaStreamDestination(): MediaStreamAudioDestinationNode {
    return this.destination as unknown as MediaStreamAudioDestinationNode;
  }

  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
    const node = new FakeSourceNode(stream as unknown as FakeMediaStream);
    this.sourceNodes.push(node);
    return node as unknown as MediaStreamAudioSourceNode;
  }

  async resume(): Promise<void> {
    this.resumeCount += 1;
    this.state = "running";
  }

  async close(): Promise<void> {
    this.closeCount += 1;
    this.state = "closed";
  }
}

function createMixer(context: FakeAudioContext | null) {
  return createProgrammeAudioMixer({
    createAudioContext: () => context as unknown as AudioContext,
    createMediaStream: (tracks) =>
      new FakeMediaStream(tracks as unknown as FakeTrack[]) as unknown as MediaStream,
  });
}

function stream(...tracks: FakeTrack[]): MediaStream {
  return new FakeMediaStream(tracks) as unknown as MediaStream;
}

describe("programme audio mixer", () => {
  it("creates one stable mixed output track and resumes it on demand", async () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);

    const firstOutput = mixer.getOutputTrack();
    expect(firstOutput).toBe(context.outputTrack);
    expect(await mixer.resume()).toBe(true);
    expect(mixer.getOutputTrack()).toBe(firstOutput);
    expect(context.resumeCount).toBe(1);
  });

  it("deterministically assigns duplicate tracks to one source", () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    const sharedTrack = new FakeTrack("shared-track");

    mixer.reconcile(new Map([
      ["source-z", stream(sharedTrack)],
      ["source-a", stream(sharedTrack)],
    ]));
    mixer.getOutputTrack();

    expect(mixer.getSourceState("source-a")).toMatchObject({
      active: true,
      trackCount: 1,
    });
    expect(mixer.getSourceState("source-z")).toMatchObject({
      active: false,
      trackCount: 0,
    });
    expect(context.sourceNodes).toHaveLength(1);
  });

  it("reconciles joined, left, and ended participant tracks without replacing output", () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    const firstTrack = new FakeTrack("first-track");
    const secondTrack = new FakeTrack("second-track");

    mixer.reconcile(new Map([["source-first", stream(firstTrack)]]));
    const outputTrack = mixer.getOutputTrack();
    const firstNode = context.sourceNodes[0];

    mixer.reconcile(new Map([["source-second", stream(secondTrack)]]));

    expect(firstNode?.disconnectCount).toBe(1);
    expect(firstTrack.listenerCount).toBe(0);
    expect(mixer.getSourceState("source-first").active).toBe(false);
    expect(mixer.getSourceState("source-second").active).toBe(true);
    expect(mixer.getOutputTrack()).toBe(outputTrack);

    secondTrack.end();
    expect(mixer.getSourceState("source-second").active).toBe(false);
  });

  it("mixes multiple tracks through one source gain and applies mute and gain", () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    const firstTrack = new FakeTrack("first-track");
    const secondTrack = new FakeTrack("second-track");

    mixer.reconcile(new Map([["source", stream(firstTrack, secondTrack)]]));
    mixer.getOutputTrack();
    const [gainNode] = context.gainNodes;

    expect(context.sourceNodes).toHaveLength(2);
    expect(mixer.getSourceState("source").trackCount).toBe(2);
    mixer.setSourceGain("source", 0.35);
    expect(gainNode?.gain.value).toBe(0.35);
    mixer.setSourceMuted("source", true);
    expect(gainNode?.gain.value).toBe(0);
    mixer.setSourceGain("source", 3);
    expect(mixer.getSourceState("source").gain).toBe(2);
    expect(gainNode?.gain.value).toBe(0);
    mixer.setSourceMuted("source", false);
    expect(gainNode?.gain.value).toBe(2);
  });

  it("preserves source controls when tracks leave and rejoin", () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    const firstTrack = new FakeTrack("first-track");
    const replacementTrack = new FakeTrack("replacement-track");

    mixer.setSourceGain("source", 0.4);
    mixer.setSourceMuted("source", true);
    mixer.reconcile(new Map([["source", stream(firstTrack)]]));
    mixer.getOutputTrack();
    expect(context.gainNodes.at(-1)?.gain.value).toBe(0);

    mixer.reconcile(new Map());
    mixer.reconcile(new Map([["source", stream(replacementTrack)]]));

    expect(mixer.getSourceState("source")).toMatchObject({
      active: true,
      gain: 0.4,
      muted: true,
    });
    expect(context.gainNodes.at(-1)?.gain.value).toBe(0);
    mixer.setSourceMuted("source", false);
    expect(context.gainNodes.at(-1)?.gain.value).toBe(0.4);
  });

  it("replaces local controls with the authoritative mix snapshot", () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    mixer.reconcile(new Map([["source", stream(new FakeTrack("input"))]]));
    mixer.getOutputTrack();

    mixer.setSourceMuted("source", true);
    expect(context.gainNodes[0]?.gain.value).toBe(0);
    mixer.reconcileControls({ source: { gain: 0.4, muted: false } });
    expect(mixer.getSourceState("source")).toMatchObject({ gain: 0.4, muted: false });
    expect(context.gainNodes[0]?.gain.value).toBe(0.4);

    mixer.reconcileControls({});
    expect(mixer.getSourceState("source")).toMatchObject({ gain: 1, muted: false });
    expect(context.gainNodes[0]?.gain.value).toBe(1);
  });

  it("requires a live mixed audio track before capture starts", () => {
    const liveTrack = new FakeTrack("programme-output") as unknown as MediaStreamTrack;

    expect(requireLiveProgrammeAudioTrack(true, liveTrack, true)).toBe(liveTrack);
    expect(() => requireLiveProgrammeAudioTrack(false, liveTrack, true)).toThrow(
      "Programme audio could not start",
    );
    const endedTrack = new FakeTrack("ended");
    endedTrack.end();
    expect(() => requireLiveProgrammeAudioTrack(
      true,
      endedTrack as unknown as MediaStreamTrack,
      true,
    )).toThrow("live mixed programme audio output");
    expect(() => requireLiveProgrammeAudioTrack(true, liveTrack, false)).toThrow(
      "no active unmuted source",
    );
  });

  it("reports whether at least one active source can reach the programme bus", () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    mixer.getOutputTrack();
    expect(mixer.hasAudibleSource()).toBe(false);

    mixer.reconcile(new Map([["source", stream(new FakeTrack("input"))]]));
    expect(mixer.hasAudibleSource()).toBe(true);
    mixer.setSourceMuted("source", true);
    expect(mixer.hasAudibleSource()).toBe(false);
    mixer.setSourceMuted("source", false);
    mixer.setSourceGain("source", 0);
    expect(mixer.hasAudibleSource()).toBe(false);
    mixer.setSourceGain("source", 0.5);
    expect(mixer.hasAudibleSource()).toBe(true);
  });

  it("measures the mixed output level on a normalized decibel scale", async () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);

    mixer.getOutputTrack();
    expect(mixer.getOutputLevel()).toBe(0);
    await mixer.resume();

    context.analyser.samples = Array.from({ length: 256 }, () => 0.1);
    expect(mixer.getOutputLevel()).toBeCloseTo(2 / 3, 5);
    context.analyser.samples = Array.from({ length: 256 }, () => 1);
    expect(mixer.getOutputLevel()).toBe(1);
    context.analyser.samples = [];
    expect(mixer.getOutputLevel()).toBe(0);
  });

  it("reports Web Audio as unavailable instead of exposing an output track", async () => {
    const mixer = createMixer(null);
    const track = new FakeTrack("input");

    mixer.reconcile(new Map([["source", stream(track)]]));
    mixer.setSourceGain("source", 0.5);
    mixer.setSourceMuted("source", true);

    expect(await mixer.resume()).toBe(false);
    expect(mixer.getOutputTrack()).toBeUndefined();
    expect(mixer.getSourceState("source")).toEqual({
      active: false,
      gain: 0.5,
      muted: true,
      sourceId: "source",
      trackCount: 0,
    });
    await expect(mixer.close()).resolves.toBeUndefined();
  });

  it("disconnects nodes, stops only its output track, and closes the context", async () => {
    const context = new FakeAudioContext();
    const mixer = createMixer(context);
    const inputTrack = new FakeTrack("input");

    mixer.reconcile(new Map([["source", stream(inputTrack)]]));
    mixer.getOutputTrack();
    const [sourceNode] = context.sourceNodes;
    const [gainNode] = context.gainNodes;
    expect(inputTrack.listenerCount).toBe(1);

    await mixer.close();

    expect(sourceNode?.disconnectCount).toBe(1);
    expect(gainNode?.disconnectCount).toBe(1);
    expect(context.analyser.disconnectCount).toBe(1);
    expect(context.destination.disconnectCount).toBe(1);
    expect(inputTrack.listenerCount).toBe(0);
    expect(inputTrack.stopped).toBe(false);
    expect(context.outputTrack.stopped).toBe(true);
    expect(context.closeCount).toBe(1);
    expect(mixer.getOutputTrack()).toBeUndefined();
  });
});

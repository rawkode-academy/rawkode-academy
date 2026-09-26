const DEFAULT_GAIN = 1;
const MAX_GAIN = 2;
const METER_FLOOR_DECIBELS = -60;
const METER_SAMPLE_COUNT = 256;

export interface ProgrammeAudioSourceState {
  active: boolean;
  gain: number;
  muted: boolean;
  sourceId: string;
  trackCount: number;
}

export interface ProgrammeAudioMixer {
  close(): Promise<void>;
  getOutputLevel(): number;
  getOutputTrack(): MediaStreamTrack | undefined;
  getSourceState(sourceId: string): ProgrammeAudioSourceState;
  hasAudibleSource(): boolean;
  reconcile(streams: ReadonlyMap<string, MediaStream>): void;
  reconcileControls(controls: Readonly<Record<string, Pick<ProgrammeAudioSourceState, "gain" | "muted">>>): void;
  resume(): Promise<boolean>;
  setSourceGain(sourceId: string, gain: number): void;
  setSourceMuted(sourceId: string, muted: boolean): void;
}

export function requireLiveProgrammeAudioTrack(
  audioReady: boolean,
  track: MediaStreamTrack | undefined,
  hasAudibleSource: boolean,
): MediaStreamTrack {
  if (!audioReady) {
    throw new Error("Programme audio could not start. Check browser audio permissions and try again.");
  }
  if (!track || track.kind !== "audio" || track.readyState !== "live") {
    throw new Error("A live mixed programme audio output is required.");
  }
  if (!hasAudibleSource) {
    throw new Error(
      "Programme audio has no active unmuted source. Connect and unmute a microphone or selected screen audio source.",
    );
  }
  return track;
}

interface AudioContextLike {
  readonly state: AudioContextState;
  close(): Promise<void>;
  createAnalyser(): AnalyserNode;
  createGain(): GainNode;
  createMediaStreamDestination(): MediaStreamAudioDestinationNode;
  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode;
  resume(): Promise<void>;
}

interface ProgrammeAudioMixerDependencies {
  createAudioContext?: () => AudioContextLike | null;
  createMediaStream?: (tracks: MediaStreamTrack[]) => MediaStream;
}

interface SourceControl {
  gain: number;
  muted: boolean;
}

interface SourceInput {
  node: MediaStreamAudioSourceNode;
  onEnded: () => void;
  track: MediaStreamTrack;
}

interface SourceGraph {
  gainNode: GainNode;
  inputs: Map<string, SourceInput>;
}

interface AudioGraph {
  analyser: AnalyserNode;
  context: AudioContextLike;
  destination: MediaStreamAudioDestinationNode;
  meterSamples: Float32Array<ArrayBuffer>;
  sources: Map<string, SourceGraph>;
}

interface DesiredTrack {
  key: string;
  track: MediaStreamTrack;
}

export function createProgrammeAudioMixer(
  dependencies: ProgrammeAudioMixerDependencies = {},
): ProgrammeAudioMixer {
  return new BrowserProgrammeAudioMixer({
    createAudioContext: dependencies.createAudioContext ?? createBrowserAudioContext,
    createMediaStream: dependencies.createMediaStream ?? ((tracks) => new MediaStream(tracks)),
  });
}

class BrowserProgrammeAudioMixer implements ProgrammeAudioMixer {
  private readonly controls = new Map<string, SourceControl>();
  private readonly createAudioContext: () => AudioContextLike | null;
  private readonly createMediaStream: (tracks: MediaStreamTrack[]) => MediaStream;
  private readonly anonymousTrackIds = new WeakMap<MediaStreamTrack, number>();
  private graph: AudioGraph | undefined;
  private streams = new Map<string, MediaStream>();
  private nextAnonymousTrackId = 1;
  private unavailable = false;
  private closed = false;

  constructor(dependencies: Required<ProgrammeAudioMixerDependencies>) {
    this.createAudioContext = dependencies.createAudioContext;
    this.createMediaStream = dependencies.createMediaStream;
  }

  reconcile(streams: ReadonlyMap<string, MediaStream>): void {
    if (this.closed) return;

    this.streams = new Map(
      [...streams.entries()].sort(([left], [right]) => compareText(left, right)),
    );
    if (this.graph) {
      this.reconcileGraph(this.graph);
    }
  }

  reconcileControls(
    controls: Readonly<Record<string, Pick<ProgrammeAudioSourceState, "gain" | "muted">>>,
  ): void {
    if (this.closed) return;

    this.controls.clear();
    for (const [sourceId, control] of Object.entries(controls)) {
      this.controls.set(sourceId, {
        gain: normalizeGain(control.gain),
        muted: control.muted,
      });
    }
    if (!this.graph) return;

    for (const sourceId of this.graph.sources.keys()) {
      this.applyControl(sourceId, this.controls.get(sourceId) ?? createDefaultControl());
    }
  }

  async resume(): Promise<boolean> {
    const graph = this.ensureGraph();
    if (!graph) return false;

    if (graph.context.state === "suspended") {
      try {
        await graph.context.resume();
      } catch {
        return false;
      }
    }

    return graph.context.state === "running";
  }

  getOutputTrack(): MediaStreamTrack | undefined {
    const graph = this.ensureGraph();
    return graph?.destination.stream
      .getAudioTracks()
      .find((track) => track.readyState === "live");
  }

  getOutputLevel(): number {
    const graph = this.graph;
    if (!graph || graph.context.state !== "running") return 0;

    graph.analyser.getFloatTimeDomainData(graph.meterSamples);
    return normalizeMeterSamples(graph.meterSamples);
  }

  setSourceMuted(sourceId: string, muted: boolean): void {
    const control = this.getOrCreateControl(sourceId);
    control.muted = muted;
    this.applyControl(sourceId, control);
  }

  setSourceGain(sourceId: string, gain: number): void {
    const control = this.getOrCreateControl(sourceId);
    control.gain = normalizeGain(gain);
    this.applyControl(sourceId, control);
  }

  getSourceState(sourceId: string): ProgrammeAudioSourceState {
    const control = this.controls.get(sourceId) ?? createDefaultControl();
    const source = this.graph?.sources.get(sourceId);
    return {
      active: Boolean(source?.inputs.size),
      gain: control.gain,
      muted: control.muted,
      sourceId,
      trackCount: source?.inputs.size ?? 0,
    };
  }

  hasAudibleSource(): boolean {
    const graph = this.graph;
    if (!graph) return false;

    for (const [sourceId, source] of graph.sources) {
      const control = this.controls.get(sourceId) ?? createDefaultControl();
      const hasLiveInput = [...source.inputs.values()].some(
        (input) => input.track.readyState === "live",
      );
      if (hasLiveInput && !control.muted && control.gain > 0) {
        return true;
      }
    }
    return false;
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    const graph = this.graph;
    this.graph = undefined;
    this.streams.clear();
    this.controls.clear();
    if (!graph) return;

    releaseAudioGraph(graph);

    if (graph.context.state !== "closed") {
      await graph.context.close().catch(() => undefined);
    }
  }

  private ensureGraph(): AudioGraph | undefined {
    if (this.graph) return this.graph;
    if (this.closed || this.unavailable) return undefined;

    let context: AudioContextLike | null = null;
    let graph: AudioGraph | undefined;
    try {
      context = this.createAudioContext();
      if (!context) {
        this.unavailable = true;
        return undefined;
      }
      const destination = context.createMediaStreamDestination();
      const analyser = context.createAnalyser();
      analyser.fftSize = METER_SAMPLE_COUNT;
      analyser.connect(destination);
      graph = {
        analyser,
        context,
        destination,
        meterSamples: new Float32Array(analyser.fftSize),
        sources: new Map(),
      };
      this.graph = graph;
      this.reconcileGraph(graph);
      return graph;
    } catch {
      this.unavailable = true;
      this.graph = undefined;
      if (graph) {
        releaseAudioGraph(graph);
      }
      if (context?.state !== "closed") {
        void context?.close().catch(() => undefined);
      }
      return undefined;
    }
  }

  private reconcileGraph(graph: AudioGraph): void {
    const desiredSources = this.collectDesiredSources();

    for (const sourceId of [...graph.sources.keys()]) {
      if (!desiredSources.has(sourceId)) {
        removeSourceGraph(graph, sourceId);
      }
    }

    for (const [sourceId, desiredTracks] of desiredSources) {
      let source = graph.sources.get(sourceId);
      if (!source) {
        let gainNode: GainNode | undefined;
        try {
          gainNode = graph.context.createGain();
          gainNode.connect(graph.analyser);
          source = {
            gainNode,
            inputs: new Map(),
          };
          graph.sources.set(sourceId, source);
        } catch {
          if (gainNode) safeDisconnect(gainNode);
          continue;
        }
      }
      this.applyControl(sourceId, this.controls.get(sourceId) ?? createDefaultControl());

      const desiredByKey = new Map(desiredTracks.map((track) => [track.key, track]));
      for (const [key, input] of source.inputs) {
        const desired = desiredByKey.get(key);
        if (!desired || desired.track !== input.track) {
          removeSourceInput(source, key);
        }
      }

      for (const desired of desiredTracks) {
        if (source.inputs.has(desired.key)) continue;
        let node: MediaStreamAudioSourceNode | undefined;
        try {
          node = graph.context.createMediaStreamSource(
            this.createMediaStream([desired.track]),
          );
          node.connect(source.gainNode);
          const onEnded = () => this.reconcileGraph(graph);
          desired.track.addEventListener("ended", onEnded);
          source.inputs.set(desired.key, {
            node,
            onEnded,
            track: desired.track,
          });
        } catch {
          if (node) safeDisconnect(node);
          // A source may end between collection and node creation. The next
          // media reconciliation can safely retry without disrupting the mix.
        }
      }

      if (source.inputs.size === 0) {
        removeSourceGraph(graph, sourceId);
      }
    }
  }

  private collectDesiredSources(): Map<string, DesiredTrack[]> {
    const desired = new Map<string, DesiredTrack[]>();
    const claimedTrackKeys = new Set<string>();

    for (const [sourceId, stream] of this.streams) {
      let tracks: DesiredTrack[];
      try {
        tracks = stream
          .getAudioTracks()
          .filter((track) => track.readyState === "live")
          .map((track) => ({ key: this.getTrackKey(track), track }))
          .sort((left, right) => compareText(left.key, right.key));
      } catch {
        continue;
      }

      for (const track of tracks) {
        if (claimedTrackKeys.has(track.key)) continue;
        claimedTrackKeys.add(track.key);
        const sourceTracks = desired.get(sourceId) ?? [];
        sourceTracks.push(track);
        desired.set(sourceId, sourceTracks);
      }
    }

    return desired;
  }

  private getTrackKey(track: MediaStreamTrack): string {
    const id = track.id.trim();
    if (id) return `id:${id}`;

    let anonymousId = this.anonymousTrackIds.get(track);
    if (!anonymousId) {
      anonymousId = this.nextAnonymousTrackId;
      this.nextAnonymousTrackId += 1;
      this.anonymousTrackIds.set(track, anonymousId);
    }
    return `anonymous:${anonymousId.toString().padStart(8, "0")}`;
  }

  private getOrCreateControl(sourceId: string): SourceControl {
    let control = this.controls.get(sourceId);
    if (!control) {
      control = createDefaultControl();
      this.controls.set(sourceId, control);
    }
    return control;
  }

  private applyControl(sourceId: string, control: SourceControl): void {
    const gainNode = this.graph?.sources.get(sourceId)?.gainNode;
    if (gainNode) {
      gainNode.gain.value = control.muted ? 0 : control.gain;
    }
  }
}

function createBrowserAudioContext(): AudioContextLike | null {
  const audioGlobal = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextConstructor = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

function removeSourceGraph(graph: AudioGraph, sourceId: string): void {
  const source = graph.sources.get(sourceId);
  if (!source) return;

  for (const key of [...source.inputs.keys()]) {
    removeSourceInput(source, key);
  }
  safeDisconnect(source.gainNode);
  graph.sources.delete(sourceId);
}

function releaseAudioGraph(graph: AudioGraph): void {
  for (const sourceId of [...graph.sources.keys()]) {
    removeSourceGraph(graph, sourceId);
  }
  for (const track of graph.destination.stream.getTracks()) {
    track.stop();
  }
  safeDisconnect(graph.analyser);
  safeDisconnect(graph.destination);
}

function removeSourceInput(source: SourceGraph, key: string): void {
  const input = source.inputs.get(key);
  if (!input) return;

  input.track.removeEventListener("ended", input.onEnded);
  safeDisconnect(input.node);
  source.inputs.delete(key);
}

function safeDisconnect(node: Pick<AudioNode, "disconnect">): void {
  try {
    node.disconnect();
  } catch {
    // Disconnect is idempotent from the mixer's perspective.
  }
}

function createDefaultControl(): SourceControl {
  return {
    gain: DEFAULT_GAIN,
    muted: false,
  };
}

function normalizeGain(gain: number): number {
  if (!Number.isFinite(gain)) return DEFAULT_GAIN;
  return Math.min(Math.max(gain, 0), MAX_GAIN);
}

function normalizeMeterSamples(samples: Float32Array): number {
  if (samples.length === 0) return 0;

  let sumOfSquares = 0;
  for (const sample of samples) {
    sumOfSquares += sample * sample;
  }
  const rootMeanSquare = Math.sqrt(sumOfSquares / samples.length);
  if (rootMeanSquare <= 0) return 0;

  const decibels = 20 * Math.log10(rootMeanSquare);
  return Math.min(
    Math.max((decibels - METER_FLOOR_DECIBELS) / -METER_FLOOR_DECIBELS, 0),
    1,
  );
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

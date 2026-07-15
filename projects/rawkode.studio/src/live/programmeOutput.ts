import { isAudibleTrack, isLiveEnabledTrack } from "../studio/programmeMedia";

export interface ProgrammeAudioContext {
  close(): Promise<void>;
  createMediaStreamDestination(): ProgrammeAudioDestinationNode;
  createMediaStreamSource(stream: MediaStream): ProgrammeAudioSourceNode;
  resume?(): Promise<void>;
  state?: AudioContextState;
}

export interface ProgrammeAudioDestinationNode {
  disconnect?(): void;
  stream: MediaStream;
}

export interface ProgrammeAudioSourceNode {
  connect(destination: ProgrammeAudioDestinationNode): unknown;
  disconnect(): void;
}

export interface ProgrammeOutputDependencies {
  createAudioContext?: () => ProgrammeAudioContext;
  createMediaStream?: (tracks: MediaStreamTrack[]) => MediaStream;
}

export interface ProgrammeOutput {
  readonly audioSourceCount: number;
  close(): Promise<void>;
  setAudioStreams(streams: Iterable<MediaStream>): void;
  stream: MediaStream;
}

interface ProgrammeAudioMix {
  close(): Promise<void>;
  readonly sourceTrackCount: number;
  setStreams(streams: Iterable<MediaStream>): void;
  track: MediaStreamTrack;
}

export async function createProgrammeOutput(
  canvasStream: MediaStream,
  audioStreams: Iterable<MediaStream> | (() => Iterable<MediaStream>),
  dependencies: ProgrammeOutputDependencies = {},
): Promise<ProgrammeOutput> {
  const createMediaStream = dependencies.createMediaStream ?? ((tracks) => new MediaStream(tracks));
  const videoTracks = canvasStream.getVideoTracks().filter(isLiveEnabledTrack);
  if (videoTracks.length === 0) {
    stopTracks(canvasStream.getTracks());
    throw new Error("Programme canvas has no live video track.");
  }

  const getAudioStreams = typeof audioStreams === "function"
    ? audioStreams
    : () => audioStreams;
  const audioMix = await createProgrammeAudioMix(getAudioStreams(), {
    ...dependencies,
    createMediaStream,
  }).catch((error: unknown) => {
    stopTracks(canvasStream.getTracks());
    throw error;
  });
  try {
    audioMix.setStreams(getAudioStreams());
  } catch (error) {
    stopTracks(canvasStream.getTracks());
    await audioMix.close().catch(() => undefined);
    throw error;
  }
  const stream = createMediaStream([...videoTracks, audioMix.track]);
  let closed = false;

  return {
    get audioSourceCount() {
      return audioMix.sourceTrackCount;
    },
    stream,
    setAudioStreams(streams: Iterable<MediaStream>): void {
      audioMix.setStreams(streams);
    },
    async close(): Promise<void> {
      if (closed) {
        return;
      }
      closed = true;
      stopTracks(canvasStream.getTracks());
      await audioMix.close();
    },
  };
}

export function collectUniqueAudibleAudioTracks(
  streams: Iterable<MediaStream>,
): MediaStreamTrack[] {
  const tracksById = new Map<string, MediaStreamTrack>();
  const tracksWithoutId = new Set<MediaStreamTrack>();
  const tracks: MediaStreamTrack[] = [];

  for (const stream of streams) {
    for (const track of stream.getAudioTracks()) {
      if (!isAudibleTrack(track)) {
        continue;
      }
      if (track.id) {
        if (tracksById.has(track.id)) {
          continue;
        }
        tracksById.set(track.id, track);
      } else if (tracksWithoutId.has(track)) {
        continue;
      } else {
        tracksWithoutId.add(track);
      }
      tracks.push(track);
    }
  }

  return tracks;
}

async function createProgrammeAudioMix(
  streams: Iterable<MediaStream>,
  dependencies: ProgrammeOutputDependencies,
): Promise<ProgrammeAudioMix> {
  const createMediaStream = dependencies.createMediaStream ?? ((tracks) => new MediaStream(tracks));
  const createAudioContext = dependencies.createAudioContext ?? (() => {
    if (typeof AudioContext === "undefined") {
      throw new Error("Web Audio mixing is unavailable in this browser.");
    }
    return new AudioContext() as unknown as ProgrammeAudioContext;
  });
  const context = createAudioContext();
  const destination = context.createMediaStreamDestination();
  const sourceNodes = new Map<
    MediaStreamTrack | string,
    { node: ProgrammeAudioSourceNode; track: MediaStreamTrack }
  >();
  let closed = false;

  const setStreams = (nextStreams: Iterable<MediaStream>): void => {
    if (closed) {
      return;
    }

    const nextTracks = new Map<MediaStreamTrack | string, MediaStreamTrack>();
    for (const track of collectUniqueAudibleAudioTracks(nextStreams)) {
      nextTracks.set(getAudioTrackKey(track), track);
    }

    const additions = new Map<
      MediaStreamTrack | string,
      { node: ProgrammeAudioSourceNode; track: MediaStreamTrack }
    >();
    try {
      for (const [key, track] of nextTracks) {
        if (sourceNodes.get(key)?.track === track) {
          continue;
        }
        const node = context.createMediaStreamSource(createMediaStream([track]));
        try {
          node.connect(destination);
        } catch (error) {
          node.disconnect();
          throw error;
        }
        additions.set(key, { node, track });
      }
    } catch (error) {
      for (const { node } of additions.values()) {
        node.disconnect();
      }
      throw error;
    }

    for (const [key, source] of sourceNodes) {
      if (nextTracks.get(key) === source.track) {
        continue;
      }
      source.node.disconnect();
      sourceNodes.delete(key);
    }
    for (const [key, source] of additions) {
      sourceNodes.set(key, source);
    }
  };

  try {
    const mixedTracks = destination.stream.getAudioTracks();
    if (mixedTracks.length !== 1 || !mixedTracks[0]) {
      throw new Error("Programme audio mixer did not produce exactly one audio track.");
    }
    const mixedTrack = mixedTracks[0];
    setStreams(streams);
    if (context.state === "suspended") {
      await context.resume?.();
    }

    return {
      get sourceTrackCount() {
        return sourceNodes.size;
      },
      setStreams,
      track: mixedTrack,
      async close(): Promise<void> {
        if (closed) {
          return;
        }
        closed = true;
        for (const { node } of sourceNodes.values()) {
          node.disconnect();
        }
        sourceNodes.clear();
        destination.disconnect?.();
        mixedTrack.stop();
        if (context.state !== "closed") {
          await context.close();
        }
      },
    };
  } catch (error) {
    closed = true;
    for (const { node } of sourceNodes.values()) {
      node.disconnect();
    }
    sourceNodes.clear();
    stopTracks(destination.stream.getTracks());
    await context.close().catch(() => undefined);
    throw error;
  }
}

function getAudioTrackKey(track: MediaStreamTrack): MediaStreamTrack | string {
  return track.id ? `track:${track.id}` : track;
}

function stopTracks(tracks: MediaStreamTrack[]): void {
  for (const track of tracks) {
    track.stop();
  }
}

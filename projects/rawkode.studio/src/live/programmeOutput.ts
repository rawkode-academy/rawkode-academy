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
  audioSourceCount: number;
  close(): Promise<void>;
  stream: MediaStream;
}

interface ProgrammeAudioMix {
  close(): Promise<void>;
  sourceTrackCount: number;
  track: MediaStreamTrack;
}

export async function createProgrammeOutput(
  canvasStream: MediaStream,
  audioStreams: Iterable<MediaStream>,
  dependencies: ProgrammeOutputDependencies = {},
): Promise<ProgrammeOutput> {
  const createMediaStream = dependencies.createMediaStream ?? ((tracks) => new MediaStream(tracks));
  const videoTracks = canvasStream.getVideoTracks().filter(isLiveEnabledTrack);
  if (videoTracks.length === 0) {
    stopTracks(canvasStream.getTracks());
    throw new Error("Programme canvas has no live video track.");
  }

  const audioMix = await createProgrammeAudioMix(audioStreams, {
    ...dependencies,
    createMediaStream,
  }).catch((error: unknown) => {
    stopTracks(canvasStream.getTracks());
    throw error;
  });
  const stream = createMediaStream([...videoTracks, audioMix.track]);
  let closed = false;

  return {
    audioSourceCount: audioMix.sourceTrackCount,
    stream,
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
  const sourceTracks = collectUniqueAudibleAudioTracks(streams);
  if (sourceTracks.length === 0) {
    throw new Error("Programme has no audible audio source.");
  }

  const createMediaStream = dependencies.createMediaStream ?? ((tracks) => new MediaStream(tracks));
  const createAudioContext = dependencies.createAudioContext ?? (() => {
    if (typeof AudioContext === "undefined") {
      throw new Error("Web Audio mixing is unavailable in this browser.");
    }
    return new AudioContext() as unknown as ProgrammeAudioContext;
  });
  const context = createAudioContext();
  const destination = context.createMediaStreamDestination();
  const sourceNodes: ProgrammeAudioSourceNode[] = [];

  try {
    for (const track of sourceTracks) {
      const sourceNode = context.createMediaStreamSource(createMediaStream([track]));
      sourceNode.connect(destination);
      sourceNodes.push(sourceNode);
    }
    if (context.state === "suspended") {
      await context.resume?.();
    }

    const mixedTracks = destination.stream.getAudioTracks();
    if (mixedTracks.length !== 1 || !mixedTracks[0]) {
      throw new Error("Programme audio mixer did not produce exactly one audio track.");
    }
    const mixedTrack = mixedTracks[0];
    let closed = false;

    return {
      sourceTrackCount: sourceTracks.length,
      track: mixedTrack,
      async close(): Promise<void> {
        if (closed) {
          return;
        }
        closed = true;
        for (const sourceNode of sourceNodes) {
          sourceNode.disconnect();
        }
        destination.disconnect?.();
        mixedTrack.stop();
        if (context.state !== "closed") {
          await context.close();
        }
      },
    };
  } catch (error) {
    for (const sourceNode of sourceNodes) {
      sourceNode.disconnect();
    }
    stopTracks(destination.stream.getTracks());
    await context.close().catch(() => undefined);
    throw error;
  }
}

function stopTracks(tracks: MediaStreamTrack[]): void {
  for (const track of tracks) {
    track.stop();
  }
}

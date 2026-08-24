import { describe, expect, it } from "vitest";
import {
  isRealtimeKitSnapshotAuthoritative,
  mapRealtimeKitParticipantSources,
  type RealtimeKitParticipant,
} from "./participantSources";

function track(
  kind: MediaStreamTrack["kind"],
  name: string,
  readyState: MediaStreamTrack["readyState"] = "live",
): MediaStreamTrack {
  return { kind, readyState, id: name } as MediaStreamTrack;
}

function participant(
  role: "guest" | "host" | "producer" | "program",
  id: string,
  overrides: Partial<RealtimeKitParticipant> = {},
): RealtimeKitParticipant {
  return {
    audioEnabled: true,
    audioTrack: track("audio", `${id}-microphone`),
    customParticipantId: `studio:${role}:${id}`,
    id: `${id}-peer`,
    name: id,
    videoEnabled: true,
    videoTrack: track("video", `${id}-camera`),
    ...overrides,
  };
}

function sourceSummary(participants: RealtimeKitParticipant[]) {
  return mapRealtimeKitParticipantSources(participants).sources.map((source) => ({
    id: source.id,
    name: source.name,
    status: source.status,
    type: source.type,
  }));
}

describe("RealtimeKit participant source mapping", () => {
  it("authorizes pruning only after the meeting reports or emits roomJoined", () => {
    expect(isRealtimeKitSnapshotAuthoritative(undefined, false)).toBe(false);
    expect(isRealtimeKitSnapshotAuthoritative({ roomJoined: false }, false)).toBe(false);
    expect(isRealtimeKitSnapshotAuthoritative({ roomJoined: true }, false)).toBe(true);
    expect(isRealtimeKitSnapshotAuthoritative(undefined, true)).toBe(true);
  });

  it("drops historical roomJoined authority after self reports leaving", () => {
    expect(isRealtimeKitSnapshotAuthoritative({ roomJoined: false }, true)).toBe(false);
  });

  it("keeps source assignment stable when participant iteration order changes", () => {
    const participants = [
      participant("guest", "charlie"),
      participant("host", "rawkode"),
      participant("guest", "alice"),
      participant("producer", "producer"),
      participant("guest", "bravo"),
    ];

    expect(sourceSummary(participants)).toEqual(
      sourceSummary([participants[3], participants[1], participants[4], participants[0], participants[2]]),
    );
  });

  it("does not change an existing participant ID when role peers join or leave", () => {
    const bob = participant("guest", "bob");
    const bobSourceId = sourceSummary([bob])[0]?.id;

    expect(sourceSummary([participant("guest", "alice"), bob])).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: bobSourceId, name: "bob" })]),
    );
    expect(sourceSummary([bob, participant("guest", "charlie")])).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: bobSourceId, name: "bob" })]),
    );
  });

  it("derives every camera source ID from participant identity instead of role position", () => {
    const mapping = mapRealtimeKitParticipantSources([
      participant("guest", "delta"),
      participant("guest", "bravo"),
      participant("guest", "charlie"),
      participant("guest", "alpha"),
      participant("host", "rawkode"),
      participant("program", "programme"),
    ]);

    const guestSources = mapping.sources.filter((source) => source.roles?.includes("guests"));
    expect(guestSources.map((source) => source.id)).toEqual([
      "source-realtimekit-camera-studio-guest-alpha",
      "source-realtimekit-camera-studio-guest-bravo",
      "source-realtimekit-camera-studio-guest-charlie",
      "source-realtimekit-camera-studio-guest-delta",
    ]);
    expect(mapping.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "source-realtimekit-camera-studio-host-rawkode", type: "camera" }),
      expect.objectContaining({ id: "source-realtimekit-camera-studio-program-programme", type: "camera" }),
    ]));
    expect(mapping.streams).toHaveLength(6);
  });

  it("marks camera sources ready only when their video track is live and enabled", () => {
    const mapping = mapRealtimeKitParticipantSources([
      participant("guest", "muted", { videoEnabled: false }),
      participant("guest", "ended", {
        videoTrack: track("video", "ended-camera", "ended"),
      }),
      participant("guest", "ready"),
    ]);

    expect(mapping.sources.map((source) => [source.name, source.status])).toEqual([
      ["ended", "muted"],
      ["muted", "muted"],
      ["ready", "ready"],
    ]);
    expect(mapping.streams[1]?.tracks.map((mediaTrack) => mediaTrack.kind)).toEqual(["audio"]);
  });

  it("keeps camera and screen-share video and audio in separate streams", () => {
    const cameraVideo = track("video", "camera");
    const microphone = track("audio", "microphone");
    const screenVideo = track("video", "screen");
    const screenAudio = track("audio", "screen-audio");
    const mapping = mapRealtimeKitParticipantSources([
      participant("guest", "speaker", {
        audioTrack: microphone,
        screenShareEnabled: true,
        screenShareTracks: {
          audio: screenAudio,
          video: screenVideo,
        },
        videoTrack: cameraVideo,
      }),
    ]);

    expect(mapping.sources).toEqual([
      expect.objectContaining({
        id: "source-realtimekit-camera-studio-guest-speaker",
        settings: expect.objectContaining({ runtimeSource: "realtimekit" }),
        type: "camera",
        status: "ready",
      }),
      expect.objectContaining({
        id: "source-realtimekit-screen-studio-guest-speaker",
        settings: expect.objectContaining({ runtimeSource: "realtimekit" }),
        type: "screen",
        status: "ready",
      }),
    ]);
    expect(mapping.streams).toEqual([
      {
        sourceId: "source-realtimekit-camera-studio-guest-speaker",
        tracks: [cameraVideo, microphone],
      },
      {
        sourceId: "source-realtimekit-screen-studio-guest-speaker",
        tracks: [screenVideo, screenAudio],
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { selectProgrammeAudioStreams } from "../audio/programmeAudioSources";
import { isStudioControlState } from "../server/control-state";
import { createInitialStudioState } from "../studio/seed";
import { reduceStudioState } from "../studio/studioMachine";
import {
  getRealtimeKitParticipantSourceIds,
  isRealtimeKitSnapshotAuthoritative,
  mapRealtimeKitParticipantSources,
  type RealtimeKitParticipant,
  type RealtimeKitProducerState,
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

function screenProducer(peerId: string, video?: MediaStreamTrack, producerId = "screen-video", transportId = "screen-transport"): RealtimeKitProducerState {
  return {
    producerId, producingPeerId: peerId, producingTransportId: transportId,
    kind: "video", pause: false, screenShare: true,
    ...(video ? { consumer: {
      id: `consumer-${producerId}`, producerId, peerId, kind: "video", paused: false,
      appData: { screenShare: true }, rtpReceiver: { track: video },
    } } : {}),
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
	it("revokes every possible source by durable participant identity on departure", () => {
		expect(getRealtimeKitParticipantSourceIds(participant("guest", "rejoining"))).toEqual([
			"source-realtimekit-camera-v2.cmVqb2luaW5nLXBlZXI",
			"source-realtimekit-screen-v2.cmVqb2luaW5nLXBlZXI",
		]);
	});

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
      "source-realtimekit-camera-v2.YWxwaGEtcGVlcg",
      "source-realtimekit-camera-v2.YnJhdm8tcGVlcg",
      "source-realtimekit-camera-v2.Y2hhcmxpZS1wZWVy",
      "source-realtimekit-camera-v2.ZGVsdGEtcGVlcg",
    ]);
    expect(mapping.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "source-realtimekit-camera-v2.cmF3a29kZS1wZWVy", type: "camera" }),
      expect.objectContaining({ id: "source-realtimekit-camera-v2.cHJvZ3JhbW1lLXBlZXI", type: "camera" }),
    ]));
    expect(mapping.streams).toHaveLength(6);
  });

  it("uses the peer's video flag for shared status while exposing only live local tracks", () => {
    const mapping = mapRealtimeKitParticipantSources([
      participant("guest", "muted", { videoEnabled: false }),
      participant("guest", "ended", {
        videoTrack: track("video", "ended-camera", "ended"),
      }),
      participant("guest", "ready"),
    ]);

    expect(mapping.sources.map((source) => [source.name, source.status])).toEqual([
      ["ended", "ready"],
      ["muted", "muted"],
      ["ready", "ready"],
    ]);
    expect(mapping.streams[1]?.tracks.map((mediaTrack) => mediaTrack.kind)).toEqual(["audio"]);
  });

  it("keeps camera audio separate and maps only matched screen video", () => {
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
        producers: [screenProducer("speaker-peer", screenVideo)],
        videoTrack: cameraVideo,
      }),
    ], "session");

    const screen = mapping.sources.find((source) => source.type === "screen")!;

    expect(mapping.sources).toEqual([
      expect.objectContaining({
        id: "source-realtimekit-camera-v2.c3BlYWtlci1wZWVy",
        settings: expect.objectContaining({ runtimeSource: "realtimekit" }),
        type: "camera",
        status: "ready",
      }),
      expect.objectContaining({
        id: expect.stringMatching(/^source-realtimekit-screen-v3\./),
        settings: expect.objectContaining({ runtimeSource: "realtimekit", realtimeKitSource: "screen",
          realtimeKitScreenProducerId: "screen-video", realtimeKitScreenTransportId: "screen-transport" }),
        type: "screen",
        status: "ready",
      }),
    ]);
    expect(mapping.streams).toEqual([
      {
        sourceId: "source-realtimekit-camera-v2.c3BlYWtlci1wZWVy",
        tracks: [cameraVideo, microphone],
      },
      {
        sourceId: screen.id,
        tracks: [screenVideo],
      },
    ]);
  });

  it("keeps punctuation collisions and their admissions and audio streams isolated", () => {
    const first = participant("guest", "first", {
      id: "alice@example.com",
      customParticipantId: "studio:guest:alice@example.com",
    });
    const second = participant("guest", "second", {
      id: "alice-example-com",
      customParticipantId: "studio:guest:alice-example-com",
    });
    const mapping = mapRealtimeKitParticipantSources([first, second]);
    const firstSource = mapping.sources.find((source) => source.name === "first")!;
    const secondSource = mapping.sources.find((source) => source.name === "second")!;
    expect(firstSource.id).not.toBe(secondSource.id);
    expect(mapping.streams.find((stream) => stream.sourceId === firstSource.id)?.tracks)
      .toContain(first.audioTrack);
    expect(mapping.streams.find((stream) => stream.sourceId === secondSource.id)?.tracks)
      .toContain(second.audioTrack);

    let state = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile", sources: mapping.sources,
    });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: firstSource.id, admitted: true });
    state = reduceStudioState(state, { type: "audioMix.source.mute", sourceId: firstSource.id, muted: true });
    const firstStream = {} as MediaStream;
    const secondStream = {} as MediaStream;
    const selected = selectProgrammeAudioStreams(
      new Map([[firstSource.id, firstStream], [secondSource.id, secondStream]]),
      state.sources,
      "",
      state.onStageSourceIds,
    );
    expect([...selected.entries()]).toEqual([[firstSource.id, firstStream]]);
    expect(state.audioMix[secondSource.id]).toBeUndefined();
  });

  it("distinguishes simultaneous peer connections for the same participant", () => {
    const first = participant("producer", "first", { id: "peer-one", customParticipantId: "same-account", userId: "same-user" });
    const second = participant("producer", "second", { id: "peer-two", customParticipantId: "same-account", userId: "same-user" });
    const mapping = mapRealtimeKitParticipantSources([first, second]);
    expect(mapping.sources).toHaveLength(2);
    expect(new Set(mapping.sources.map((source) => source.id)).size).toBe(2);
  });

  it("keeps shared peer and screen membership stable while a standby waits for tracks", () => {
    const screen = track("video", "screen");
    const ready = participant("guest", "guest", {
      screenShareEnabled: true,
      screenShareTracks: { video: screen, audio: track("audio", "screen-audio") },
      producers: [screenProducer("guest-peer", screen)],
    });
    const delayed = { ...ready, audioTrack: undefined, videoTrack: undefined, screenShareTracks: undefined,
      screenShareEnabled: false, producers: [screenProducer("guest-peer")] };
    const primary = mapRealtimeKitParticipantSources([ready], "session");
    const standby = mapRealtimeKitParticipantSources([delayed], "session");
    expect(primary.sources).toEqual(standby.sources);
    expect(primary.streams).toHaveLength(2);
    expect(standby.streams).toEqual([]);

    let state = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: primary.sources,
    });
    for (const source of primary.sources) {
      state = reduceStudioState(state, { type: "source.admission.set", sourceId: source.id, admitted: true });
    }
    const afterStandby = reduceStudioState(state, {
      type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: standby.sources,
    });
    expect(afterStandby.onStageSourceIds).toEqual(primary.sources.map((source) => source.id));
    expect(afterStandby.sources).toEqual(state.sources);
    const endedShare = mapRealtimeKitParticipantSources([{ ...delayed, producers: [] }], "session");
    const afterShareEnds = reduceStudioState(afterStandby, {
      type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: endedShare.sources,
      departedSourceIds: [primary.sources[1].id],
    });
    expect(afterShareEnds.onStageSourceIds).toEqual([primary.sources[0].id]);
  });

  it("uses a bounded SHA-256 publication identity for each session, peer, transport and producer", () => {
    const video = track("video", "screen");
    const peer = participant("guest", "guest", {
      id: "peér", screenShareEnabled: true, screenShareTracks: { video },
      producers: [screenProducer("peér", video, "producer.a", "transport-b")],
    });
    const screenId = (value: RealtimeKitParticipant, sessionId = "session-🦊") =>
      mapRealtimeKitParticipantSources([value], sessionId).sources.find((source) => source.type === "screen")?.id;
    const first = screenId(peer)!;
    expect(first).toMatch(/^source-realtimekit-screen-v3\./);
    const digest = createHash("sha256").update(JSON.stringify(["session-🦊", "peér", "transport-b", "producer.a"])).digest("base64url");
    expect(first).toBe(`source-realtimekit-screen-v3.${digest}`);
    const changedSession = screenId(peer, "session-🦋");
    const changedPeer = screenId({ ...peer, id: "peér2", producers: [screenProducer("peér2", video, "producer.a", "transport-b")] });
    const changedTransport = screenId({ ...peer, producers: [screenProducer("peér", video, "producer.a", "transport-b2")] });
    const changedProducer = screenId({ ...peer, producers: [screenProducer("peér", video, "producer.b", "transport-b")] });
    expect(new Set([first, changedSession, changedPeer, changedTransport, changedProducer]).size).toBe(5);
    expect(screenId(peer, "\ud800")).toBeUndefined();
    const longSession = "a-real-show-with-a-long-name-".repeat(120);
    const longId = screenId(peer, longSession)!;
    expect(longId).toHaveLength(first.length);
    expect(longId).not.toBe(first);
    expect(screenId(peer, `${longSession}-another`)).not.toBe(longId);
    expect(mapRealtimeKitParticipantSources([peer]).sources.map((source) => source.type)).toEqual(["camera"]);
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: mapRealtimeKitParticipantSources([peer], "session-🦊").sources });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: first, admitted: true });
    expect(isStudioControlState(state)).toBe(true);
    const next = mapRealtimeKitParticipantSources([{ ...peer, producers: [screenProducer("peér", video, "producer.b", "transport-b")] }], "session-🦊");
    state = reduceStudioState(state, { type: "sources.reconcile", sources: next.sources, departedSourceIds: [first] });
    expect(state.onStageSourceIds).not.toContain(changedProducer);
  });

  it("derives membership from joined metadata and fails closed on ambiguous publications", () => {
    const video = track("video", "screen");
    const valid = screenProducer("peer", video);
    const joined = participant("guest", "guest", { id: "peer", screenShareEnabled: true,
      screenShareTracks: { video }, producers: [valid] });
    const standby = { ...joined, screenShareEnabled: false, screenShareTracks: undefined,
      producers: [screenProducer("peer")] };
    const primary = mapRealtimeKitParticipantSources([joined], "session", [joined]);
    const waiting = mapRealtimeKitParticipantSources([standby], "session", [standby]);
    expect(waiting.sources).toEqual(primary.sources);
    expect(waiting.streams.find((stream) => stream.sourceId === waiting.sources[1].id)).toBeUndefined();
    const activeOnly = mapRealtimeKitParticipantSources([joined], "session", [{ ...joined, producers: [] }]);
    expect(activeOnly.sources.map((source) => source.type)).toEqual(["camera"]);
    for (const producers of [
      undefined, [], [valid, { ...valid }], [valid, screenProducer("peer", video, "other")],
      [{ ...valid, pause: true }], [{ ...valid, producingPeerId: "other" }],
      [{ ...valid, producingTransportId: "" }], [{ ...valid, producerId: undefined }],
      [valid, { kind: undefined, screenShare: true }],
    ]) {
      const result = mapRealtimeKitParticipantSources([{ ...joined, producers }], "session");
      expect(result.sources.map((source) => source.type)).toEqual(["camera"]);
      expect(result.streams.every((stream) => stream.sourceId.startsWith("source-realtimekit-camera-v2."))).toBe(true);
    }
  });

  it("rejects stale or inconsistent consumer tracks without removing publication membership", () => {
    const video = track("video", "screen");
    const stale = track("video", "old-screen");
    const muted = { ...track("video", "muted-screen"), muted: true } as MediaStreamTrack;
    const producer = screenProducer("peer", video);
    const peer = participant("guest", "guest", { id: "peer", screenShareEnabled: true,
      screenShareTracks: { video, audio: track("audio", "unrelated-screen-audio") }, producers: [producer] });
    const invalid = [
      { ...peer, screenShareEnabled: false },
      { ...peer, screenShareEnabled: true, screenshareEnabled: false },
      { ...peer, screenShareTracks: { video: stale } },
      { ...peer, screenShareTracks: { video, videoTrack: stale } },
      { ...peer, screenShareTracks: { video: muted }, producers: [screenProducer("peer", muted)] },
      { ...peer, producers: [{ ...producer, consumer: undefined }] },
      ...[
        { id: undefined }, { producerId: "other" }, { peerId: "other" }, { kind: "audio" },
        { paused: true }, { appData: { screenShare: false } }, { rtpReceiver: { track: stale } },
      ].map((change) => ({ ...peer, producers: [{ ...producer, consumer: { ...producer.consumer, ...change } }] })),
    ];
    for (const entry of invalid) {
      const result = mapRealtimeKitParticipantSources([entry], "session");
      const screen = result.sources.find((source) => source.type === "screen");
      expect(screen).toBeDefined();
      expect(result.streams.some((stream) => stream.sourceId === screen!.id)).toBe(false);
    }
  });

  it("encodes full Unicode peer IDs without normalizing or conflating them", () => {
    const peers = ["é", "e\u0301", "🦊", "_", "-"];
    const mapped = peers.map((id) => getRealtimeKitParticipantSourceIds({ id }));
    expect(mapped.every((ids) => ids.length === 2)).toBe(true);
    expect(new Set(mapped.map((ids) => ids[0])).size).toBe(peers.length);
    expect(getRealtimeKitParticipantSourceIds({ id: "🦊" })).toEqual([
      "source-realtimekit-camera-v2.8J-mig",
      "source-realtimekit-screen-v2.8J-mig",
    ]);
    expect(getRealtimeKitParticipantSourceIds({ id: "\ud800" })).toEqual([]);
  });

  it("omits missing, conflicting and oversized peer identities", () => {
    const noPeer = participant("guest", "anonymous", { id: undefined, name: "Same name" });
    expect(getRealtimeKitParticipantSourceIds(noPeer)).toEqual([]);
    expect(mapRealtimeKitParticipantSources([noPeer, { ...noPeer }]).sources).toEqual([]);

    const first = participant("guest", "first", { id: "same-peer", userId: "user-one" });
    const other = participant("guest", "other", { id: "same-peer", userId: "user-two" });
    expect(mapRealtimeKitParticipantSources([first, { ...first }]).sources).toHaveLength(1);
    expect(mapRealtimeKitParticipantSources([first, other]).sources).toEqual([]);

    const boundary = participant("guest", "bounded", { id: "x".repeat(158) });
    const bounded = mapRealtimeKitParticipantSources([boundary]);
    expect(bounded.sources[0]?.id.length).toBe(240);
    const state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: bounded.sources });
    expect(isStudioControlState(state)).toBe(true);
    const tooLong = participant("guest", "too-long", { id: "x".repeat(159) });
    expect(getRealtimeKitParticipantSourceIds(tooLong)).toEqual([]);
    expect(mapRealtimeKitParticipantSources([tooLong]).sources).toEqual([]);
  });

  it("requires fresh admission on reconnect and ignores a late old-peer departure", () => {
    const oldPeer = participant("guest", "old", { id: "peer-old", customParticipantId: "same-user" });
    const newPeer = participant("guest", "new", { id: "peer-new", customParticipantId: "same-user" });
    const oldSource = mapRealtimeKitParticipantSources([oldPeer]).sources[0];
    const newSource = mapRealtimeKitParticipantSources([newPeer]).sources[0];
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: [oldSource] });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: oldSource.id, admitted: true });
    state = reduceStudioState(state, { type: "sources.reconcile", sources: [oldSource, newSource] });
    expect(state.onStageSourceIds).not.toContain(newSource.id);
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: newSource.id, admitted: true });
    state = reduceStudioState(state, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [newSource],
      departedSourceIds: getRealtimeKitParticipantSourceIds(oldPeer),
    });
    expect(state.onStageSourceIds).toContain(newSource.id);
    expect(state.onStageSourceIds).not.toContain(oldSource.id);
  });

  it("does not transfer admission or mix from a legacy sanitized source ID", () => {
    const peer = participant("guest", "same", { id: "legacy-peer" });
    const newSource = mapRealtimeKitParticipantSources([peer]).sources[0];
    const oldSource = {
      ...newSource,
      id: "source-realtimekit-camera-studio-guest-same",
    };
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: [oldSource] });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: oldSource.id, admitted: true });
    state = reduceStudioState(state, { type: "audioMix.source.mute", sourceId: oldSource.id, muted: true });
    state = reduceStudioState(state, {
      type: "sources.reconcile", authoritativeRuntimeSource: "realtimekit", sources: [newSource],
    });
    expect(state.onStageSourceIds).not.toContain(newSource.id);
    expect(state.onStageSourceIds).not.toContain(oldSource.id);
    expect(state.audioMix[newSource.id]).toBeUndefined();
  });
});

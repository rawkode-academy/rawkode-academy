import { describe, expect, it } from "vitest";
import { selectProgrammeAudioStreams } from "../audio/programmeAudioSources";
import { getRequiredProgrammeAudioSourceIds, hasRequiredTakeoverMedia } from "../live/takeoverReadiness";
import { mapRealtimeKitParticipantSources } from "../realtimekit/participantSources";
import type { StudioLayer, StudioSource } from "../types";
import { filterProgrammeScreenLayers, isOwnedProducerScreen, isVisibleProducerScreen, selectRoomCameraStreams } from "./programmeMediaGate";
import { createInitialStudioState } from "./seed";
import { selectOnStageLayers } from "./sourceAdmission";
import { reduceStudioState } from "./studioMachine";

function layer(type: StudioLayer["type"], sourceId: string): StudioLayer {
  return { id: `layer-${sourceId}`, name: sourceId, type, sourceId, enabled: true, opacity: 1,
    bounds: { x: 0, y: 0, width: 100, height: 100 } };
}

describe("programme screen gate", () => {
  it("keeps an admitted remote screen out of video, audio and takeover requirements", () => {
    const peer = {
      id: "peer-one", name: "Guest", videoEnabled: true, screenShareEnabled: true,
      videoTrack: { kind: "video", readyState: "live" } as MediaStreamTrack,
      screenShareTracks: { video: { kind: "video", readyState: "live" } as MediaStreamTrack },
    };
    const before = mapRealtimeKitParticipantSources([peer]);
    const after = mapRealtimeKitParticipantSources([{
      ...peer, screenShareTracks: { video: { kind: "video", readyState: "live" } as MediaStreamTrack },
    }]);
    const camera = before.sources.find((source) => source.type === "camera")!;
    const oldScreen = before.sources.find((source) => source.type === "screen")!;
    const newScreen = after.sources.find((source) => source.type === "screen")!;
    // Even if a stop event is missed and the new capture inherits this ID,
    // neither its video nor its audio is passed to the programme.
    expect(newScreen.id).toBe(oldScreen.id);
    const cameraStream = {} as MediaStream;
    const screenStream = {} as MediaStream;
    const sources = new Map(after.sources.map((source) => [source.id, source]));
    const streams = selectRoomCameraStreams(new Map([
      [camera.id, cameraStream], [newScreen.id, screenStream],
    ]), sources);
    const safeLayers = filterProgrammeScreenLayers([layer("camera", camera.id), layer("screen", oldScreen.id)], after.sources);
    const selectedScreen = safeLayers.find((candidate) => candidate.type === "screen")?.sourceId ?? "";
    expect(safeLayers.map((candidate) => candidate.sourceId)).toEqual([camera.id]);
    expect([...streams.entries()]).toEqual([[camera.id, cameraStream]]);
    expect([...selectProgrammeAudioStreams(streams, after.sources, selectedScreen, [camera.id, oldScreen.id]).keys()])
      .toEqual([camera.id]);
    expect(getRequiredProgrammeAudioSourceIds(after.sources, [camera.id, oldScreen.id], selectedScreen, {}))
      .toEqual([camera.id]);
  });

  it("blocks remote and stale screens while retaining foreign local screens as takeover requirements", () => {
    const local: StudioSource = {
      id: "local-screen", name: "Local", type: "screen", status: "ready",
      settings: { runtimeSource: "local", runtimeOwnerId: "owner-a" },
    };
    const other: StudioSource = {
      ...local, id: "other-screen", settings: { runtimeSource: "local", runtimeOwnerId: "owner-b" },
    };
    const legacy = "source-realtimekit-screen-stale";
    const safe = filterProgrammeScreenLayers([
      layer("screen", local.id), layer("screen", other.id), layer("screen", legacy), layer("screen", "unknown"),
    ], [local, other]);
    expect(safe.map((candidate) => candidate.sourceId)).toEqual([local.id, other.id]);
    expect(isOwnedProducerScreen(local.id, "owner-a", [local, other])).toBe(true);
    expect(isOwnedProducerScreen(other.id, "owner-a", [local, other])).toBe(false);
    // App decorates an unavailable foreign capture before checking visibility.
    const unavailable = { ...other, settings: { ...other.settings, runtimeSource: "unavailable-local" } };
    expect(isVisibleProducerScreen(unavailable, "owner-a", [local], [other.id])).toBe(true);
    expect(isVisibleProducerScreen(unavailable, "owner-a", [local], [])).toBe(false);
    const remote = { ...other, settings: { runtimeSource: "realtimekit" } };
    expect(isVisibleProducerScreen(remote, "owner-a", [local], [other.id])).toBe(false);

    // A stale layer of any type cannot retrieve a remote stream when the
    // current room snapshot does not identify it as a camera.
    const staleStream = {} as MediaStream;
    expect(selectRoomCameraStreams(new Map([[legacy, staleStream]]), new Map())).toEqual(new Map());
    const localStream = {} as MediaStream;
    const localStreams = new Map([[local.id, localStream]]);
    expect([...selectProgrammeAudioStreams(localStreams, [local], local.id, [local.id]).keys()]).toEqual([local.id]);
    expect(getRequiredProgrammeAudioSourceIds([local], [local.id], local.id, {})).toEqual([local.id]);
    // The foreign local layer remains visible to takeover readiness, but this
    // tab cannot supply its stream. The primary can remove it from stage.
    expect(hasRequiredTakeoverMedia([safe[1]], localStreams, [], new Map())).toBe(false);
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: [other] });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: other.id, admitted: true });
    const foreignLayers = [layer("screen", other.id)];
    expect(hasRequiredTakeoverMedia(selectOnStageLayers(foreignLayers, state.onStageSourceIds), localStreams, [], new Map()))
      .toBe(false);
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: other.id, admitted: false });
    expect(hasRequiredTakeoverMedia(selectOnStageLayers(foreignLayers, state.onStageSourceIds), localStreams, [], new Map()))
      .toBe(true);
  });
});

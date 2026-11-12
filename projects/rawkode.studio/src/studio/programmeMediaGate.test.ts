import { describe, expect, it } from "vitest";
import { selectProgrammeAudioStreams } from "../audio/programmeAudioSources";
import { getRequiredProgrammeAudioSourceIds, hasRequiredTakeoverMedia } from "../live/takeoverReadiness";
import type { StudioLayer, StudioSource } from "../types";
import { canChangeScreenAdmission, filterProgrammeScreenLayers, isOwnedProducerScreen, isVisibleProducerScreen, selectRoomProgrammeStreams } from "./programmeMediaGate";
import { createInitialStudioState } from "./seed";
import { selectOnStageLayers } from "./sourceAdmission";
import { reduceStudioState } from "./studioMachine";

function layer(type: StudioLayer["type"], sourceId: string): StudioLayer {
  return { id: `layer-${sourceId}`, name: sourceId, type, sourceId, enabled: true, opacity: 1,
    bounds: { x: 0, y: 0, width: 100, height: 100 } };
}

function guestScreen(id: string): StudioSource {
  return { id, name: "Guest screen", type: "screen", status: "ready",
    settings: { runtimeSource: "realtimekit", realtimeKitSource: "screen" } };
}

function stream(video: MediaStreamTrack[], audio: MediaStreamTrack[] = []): MediaStream {
  return { getVideoTracks: () => video, getAudioTracks: () => audio } as MediaStream;
}

describe("programme screen gate", () => {
  it("permits an admitted guest screen publication's video without routing or requiring screen audio", () => {
    const screen = guestScreen("source-realtimekit-screen-v3.share-a");
    const videoTrack = { kind: "video", readyState: "live", enabled: true, muted: false } as MediaStreamTrack;
    const screenStream = stream([videoTrack]);
    const streams = selectRoomProgrammeStreams(new Map([[screen.id, screenStream]]), new Map([[screen.id, screen]]));
    const layers = filterProgrammeScreenLayers(selectOnStageLayers([layer("screen", screen.id)], [screen.id]), [screen]);
    expect([...streams.keys()]).toEqual([screen.id]);
    expect(layers.map((candidate) => candidate.sourceId)).toEqual([screen.id]);
    expect(selectProgrammeAudioStreams(streams, [screen], screen.id, [screen.id]).size).toBe(0);
    expect(getRequiredProgrammeAudioSourceIds([screen], [screen.id], screen.id, {})).toEqual([]);
    const video = { srcObject: screenStream, readyState: 2, videoWidth: 1280, videoHeight: 720 } as HTMLVideoElement;
    expect(hasRequiredTakeoverMedia(layers, streams, [], new Map([[screen.id, video]]))).toBe(true);
    expect(hasRequiredTakeoverMedia(layers, new Map(), [], new Map())).toBe(false);
  });

  it("does not pass audio, legacy screens, or a new publication under an older admission", () => {
    const oldScreen = guestScreen("source-realtimekit-screen-v3.share-a");
    const nextScreen = guestScreen("source-realtimekit-screen-v3.share-b");
    const legacy = guestScreen("source-realtimekit-screen-v2.peer");
    const video = { kind: "video", readyState: "live" } as MediaStreamTrack;
    const audio = { kind: "audio", readyState: "live" } as MediaStreamTrack;
    const contaminated = stream([video], [audio]);
    const videoOnly = stream([video]);
    const sources = new Map([[nextScreen.id, nextScreen], [legacy.id, legacy]]);
    expect(selectRoomProgrammeStreams(new Map([[nextScreen.id, contaminated], [legacy.id, videoOnly]]), sources).size).toBe(0);
    const safeStreams = selectRoomProgrammeStreams(new Map([[nextScreen.id, videoOnly]]), sources);
    const admitted = selectOnStageLayers([layer("screen", nextScreen.id)], [oldScreen.id, legacy.id]);
    expect(admitted).toEqual([]);
    expect(safeStreams.has(oldScreen.id)).toBe(false);
    expect(filterProgrammeScreenLayers([layer("screen", legacy.id)], [legacy])).toEqual([]);
    expect(selectProgrammeAudioStreams(new Map([[nextScreen.id, contaminated]]), [nextScreen], nextScreen.id, [nextScreen.id]).size).toBe(0);
  });

  it("requires a decoded local preview to admit a guest screen, but always permits removing it", () => {
    const screen = guestScreen("source-realtimekit-screen-v3.share-a");
    const track = { kind: "video", readyState: "live", enabled: true, muted: false } as MediaStreamTrack;
    const current = stream([track]);
    const stale = stream([{ kind: "video", readyState: "live", enabled: true, muted: false } as MediaStreamTrack]);
    expect(canChangeScreenAdmission(screen, false, undefined, undefined, undefined)).toBe(false);
    expect(canChangeScreenAdmission(screen, false, current, stale, track)).toBe(false);
    expect(canChangeScreenAdmission(screen, false, current, current, track)).toBe(true);
    Object.assign(track, { muted: true });
    expect(canChangeScreenAdmission(screen, false, current, current, track)).toBe(false);
    Object.assign(track, { muted: false, readyState: "ended" });
    expect(canChangeScreenAdmission(screen, false, current, current, track)).toBe(false);
    expect(canChangeScreenAdmission(screen, false, stale, stale, track)).toBe(false);
    expect(canChangeScreenAdmission(screen, true, undefined, undefined, undefined)).toBe(true);
  });

  it("retains foreign local and unavailable admitted guest screens as takeover requirements", () => {
    const local: StudioSource = { id: "local-screen", name: "Local", type: "screen", status: "ready",
      settings: { runtimeSource: "local", runtimeOwnerId: "owner-a" } };
    const other: StudioSource = { ...local, id: "other-screen", settings: { runtimeSource: "local", runtimeOwnerId: "owner-b" } };
    const remote = guestScreen("source-realtimekit-screen-v3.remote");
    const safe = filterProgrammeScreenLayers([
      layer("screen", local.id), layer("screen", other.id), layer("screen", remote.id), layer("screen", "unknown"),
    ], [local, other, remote]);
    expect(safe.map((candidate) => candidate.sourceId)).toEqual([local.id, other.id, remote.id]);
    expect(isOwnedProducerScreen(local.id, "owner-a", [local, other])).toBe(true);
    expect(isOwnedProducerScreen(other.id, "owner-a", [local, other])).toBe(false);
    const unavailable = { ...other, settings: { ...other.settings, runtimeSource: "unavailable-local" } };
    expect(isVisibleProducerScreen(unavailable, "owner-a", [local], [other.id], new Map())).toBe(true);
    expect(isVisibleProducerScreen(unavailable, "owner-a", [local], [], new Map())).toBe(false);
    expect(isVisibleProducerScreen(remote, "owner-a", [local], [remote.id], new Map())).toBe(true);
    expect(isVisibleProducerScreen(remote, "owner-a", [local], [], new Map())).toBe(false);
    expect(isVisibleProducerScreen(remote, "owner-a", [local], [], new Map([[remote.id, remote]]))).toBe(true);
    const localStream = stream([{ kind: "video" } as MediaStreamTrack], [{ kind: "audio" } as MediaStreamTrack]);
    expect([...selectProgrammeAudioStreams(new Map([[local.id, localStream]]), [local], local.id, [local.id]).keys()]).toEqual([local.id]);
    expect(getRequiredProgrammeAudioSourceIds([local], [local.id], local.id, {})).toEqual([local.id]);
    expect(hasRequiredTakeoverMedia([safe[1]], new Map(), [], new Map())).toBe(false);
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: [other] });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: other.id, admitted: true });
    const foreignLayers = [layer("screen", other.id)];
    expect(hasRequiredTakeoverMedia(selectOnStageLayers(foreignLayers, state.onStageSourceIds), new Map(), [], new Map())).toBe(false);
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: other.id, admitted: false });
    expect(hasRequiredTakeoverMedia(selectOnStageLayers(foreignLayers, state.onStageSourceIds), new Map(), [], new Map())).toBe(true);
  });
});

import { describe, expect, it, vi } from "vitest";
import { selectProgrammeAudioStreams } from "../audio/programmeAudioSources";
import type { StudioSource } from "../types";
import { createInitialStudioState } from "./seed";
import { getScene, getSceneLayers, reduceStudioState } from "./studioMachine";
import { selectOnStageLayers } from "./sourceAdmission";
import {
  createLocalSourceIdentity,
  getOwnedLocalSourceIds,
  shouldPersistOwnedSourceCleanup,
} from "./localSourceOwnership";

describe("local source ownership", () => {
  it("creates a fresh in-memory producer identity for each tab or reload", () => {
    const createId = vi.fn().mockReturnValueOnce("owner-a").mockReturnValueOnce("owner-b");
    const first = createLocalSourceIdentity(createId);
    const second = createLocalSourceIdentity(createId);

    expect(first).toEqual({ ownerId: "owner-a", cameraSourceId: "source-producer-camera-owner-a" });
    expect(second).toEqual({ ownerId: "owner-b", cameraSourceId: "source-producer-camera-owner-b" });
    expect(first.cameraSourceId).not.toBe(second.cameraSourceId);
    expect(first.cameraSourceId).not.toBe("source-producer-camera");
  });

  it("does not transfer legacy or another tab's camera admission and mix", () => {
    const first = createLocalSourceIdentity(() => "owner-a");
    const second = createLocalSourceIdentity(() => "owner-b");
    const camera = (identity: typeof first): StudioSource => ({
      id: identity.cameraSourceId,
      name: "Producer Camera",
      type: "camera",
      status: "ready",
      roles: ["producer"],
      settings: { runtimeOwnerId: identity.ownerId, runtimeSource: "local" },
    });
    let state = createInitialStudioState();
    state.onStageSourceIds = ["source-producer-camera"];
    state.audioMix = { "source-producer-camera": { gain: 0.2, muted: true } };
    state = reduceStudioState(state, { type: "sources.reconcile", sources: [camera(first), camera(second)] });
    const secondStream = {} as MediaStream;
    const secondTabMedia = new Map([[second.cameraSourceId, secondStream]]);

    expect(state.onStageSourceIds).not.toContain(first.cameraSourceId);
    expect(state.onStageSourceIds).not.toContain(second.cameraSourceId);
    expect(state.audioMix[second.cameraSourceId]).toBeUndefined();
    expect(selectProgrammeAudioStreams(secondTabMedia, state.sources, "", state.onStageSourceIds).size).toBe(0);

    state = reduceStudioState(state, { type: "source.admission.set", sourceId: first.cameraSourceId, admitted: true });
    state = reduceStudioState(state, { type: "audioMix.source.mute", sourceId: first.cameraSourceId, muted: true });
    expect(selectProgrammeAudioStreams(secondTabMedia, state.sources, "", state.onStageSourceIds).size).toBe(0);
    const layers = selectOnStageLayers(
      getSceneLayers(state, "guests"), state.onStageSourceIds, getScene(state, "guests"), state.resolution,
    );
    expect(layers.some((layer) => layer.sourceId === first.cameraSourceId)).toBe(true);
    expect(layers.some((layer) => layer.sourceId === second.cameraSourceId)).toBe(false);
    expect(state.audioMix[second.cameraSourceId]).toBeUndefined();

    state = reduceStudioState(state, { type: "source.admission.set", sourceId: second.cameraSourceId, admitted: true });
    expect([...selectProgrammeAudioStreams(secondTabMedia, state.sources, "", state.onStageSourceIds).keys()])
      .toEqual([second.cameraSourceId]);
  });

  it("collects only the tab's camera and screens for best-effort cleanup", () => {
    const first = createLocalSourceIdentity(() => "owner-a");
    const sources: StudioSource[] = [
      { id: "screen-a", name: "A", type: "screen", status: "ready", settings: { runtimeOwnerId: "owner-a", runtimeSource: "local" } },
      { id: "screen-b", name: "B", type: "screen", status: "ready", settings: { runtimeOwnerId: "owner-b", runtimeSource: "local" } },
      { id: "remote", name: "Remote", type: "screen", status: "ready", settings: { runtimeOwnerId: "owner-a", runtimeSource: "realtimekit" } },
    ];
    expect(getOwnedLocalSourceIds(first, sources)).toEqual([first.cameraSourceId, "screen-a"]);
  });

  it("requires fresh admission when the same tab loses and reacquires capture", () => {
    const identity = createLocalSourceIdentity(() => "owner-a");
    const camera: StudioSource = {
      id: identity.cameraSourceId,
      name: "Producer Camera",
      type: "camera",
      status: "ready",
      roles: ["producer"],
      settings: { runtimeOwnerId: identity.ownerId, runtimeSource: "local" },
    };
    let state = reduceStudioState(createInitialStudioState(), { type: "sources.reconcile", sources: [camera] });
    state = reduceStudioState(state, { type: "source.admission.set", sourceId: camera.id, admitted: true });
    state = reduceStudioState(state, {
      type: "sources.reconcile",
      sources: [{ ...camera, status: "missing" }],
      departedSourceIds: [camera.id],
    });
    state = reduceStudioState(state, { type: "sources.reconcile", sources: [camera] });
    expect(state.onStageSourceIds).not.toContain(camera.id);
    expect(selectProgrammeAudioStreams(new Map([[camera.id, {} as MediaStream]]), state.sources, "", state.onStageSourceIds).size)
      .toBe(0);
  });

  it("does not remove live local sources when pagehide enters the back-forward cache", () => {
    expect(shouldPersistOwnedSourceCleanup({ persisted: true })).toBe(false);
    expect(shouldPersistOwnedSourceCleanup({ persisted: false })).toBe(true);
    expect(shouldPersistOwnedSourceCleanup()).toBe(true);
  });
});

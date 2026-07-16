import { describe, expect, it } from "vitest";
import type { PeopleRole, StudioSource } from "../types";
import { createInitialStudioState, STUDIO_SCENE_DEFINITIONS } from "./seed";
import { reconcileStudioSources } from "./sourceReconciliation";
import { getScene, getSceneLayers, reduceStudioState } from "./studioMachine";

function camera(
  id: string,
  name: string,
  role: PeopleRole,
  status: StudioSource["status"] = "ready",
): StudioSource {
  return {
    id,
    name,
    type: "camera",
    status,
    roles: [role],
    label: name,
    settings: { runtimeSource: "realtimekit" },
  };
}

function screen(id: string, name: string, status: StudioSource["status"] = "ready"): StudioSource {
  return {
    id,
    name,
    type: "screen",
    status,
    settings: { runtimeSource: "realtimekit" },
  };
}

function audio(id: string, name: string): StudioSource {
  return {
    id,
    name,
    type: "audio",
    status: "ready",
    settings: { runtimeSource: "realtimekit" },
  };
}

describe("source reconciliation", () => {
  it("preserves shared sources for standby setup, close, and unmount snapshots", () => {
    const initial = createInitialStudioState();
    const unopened = reduceStudioState(initial, {
      type: "sources.reconcile",
      sources: [],
    });

    expect(unopened.sources.map((source) => source.id)).toEqual(
      initial.sources.map((source) => source.id),
    );

    const remoteHost = camera("participant-host", "Host", "hosts");
    const otherTabScreen = {
      ...screen("local-screen-other-tab", "Other producer screen"),
      settings: { runtimeSource: "local" },
    };
    const joined = reduceStudioState(initial, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [remoteHost, otherTabScreen],
    });
    const closed = reduceStudioState(joined, {
      type: "sources.reconcile",
      sources: [],
    });

    expect(closed.sources).toEqual(expect.arrayContaining([remoteHost, otherTabScreen]));
  });

  it("lets an authoritative participant-left snapshot prune remote sources only", () => {
    const remoteHost = camera("participant-host", "Host", "hosts");
    const remoteGuest = camera("participant-guest", "Guest", "guests");
    const otherTabScreen = {
      ...screen("local-screen-other-tab", "Other producer screen"),
      settings: { runtimeSource: "local" },
    };
    const joined = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [remoteHost, remoteGuest, otherTabScreen],
    });
    const participantLeft = reduceStudioState(joined, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [remoteHost],
    });

    expect(participantLeft.sources).toContainEqual(remoteHost);
    expect(participantLeft.sources).toContainEqual(otherTabScreen);
    expect(participantLeft.sources.some((source) => source.id === remoteGuest.id)).toBe(false);
  });

  it("reapplies this tab's local screen after adopting another producer's conflict winner", () => {
    const remoteWinnerScreen = {
      ...screen("local-screen-remote-winner", "Remote winner screen"),
      settings: { runtimeOwnerId: "remote-owner", runtimeSource: "local" },
    };
    const thisTabScreen = {
      ...screen("local-screen-this-tab", "This tab screen"),
      settings: { runtimeOwnerId: "this-owner", runtimeSource: "local" },
    };
    const conflictWinner = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      sources: [remoteWinnerScreen],
    });

    const reapplied = reduceStudioState(conflictWinner, {
      type: "sources.reconcile",
      sources: [thisTabScreen],
    });

    expect(reapplied.sources).toEqual(expect.arrayContaining([
      remoteWinnerScreen,
      thisTabScreen,
    ]));
  });

  it("removes only the local screen source named by an exact stop event", () => {
    const remoteHost = camera("participant-host", "Host", "hosts");
    const localScreen = {
      ...screen("local-screen", "Local screen"),
      settings: { runtimeSource: "local" },
    };
    const sourced = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [remoteHost, localScreen],
    });
    const stopped = reduceStudioState(sourced, {
      type: "source.remove",
      sourceId: localScreen.id,
    });

    expect(stopped.sources).toContainEqual(remoteHost);
    expect(stopped.sources.some((source) => source.id === localScreen.id)).toBe(false);
  });

  it("compiles arbitrary runtime participant IDs through role selectors", () => {
    const state = createInitialStudioState();
    const runtimeSources = [
      camera("realtimekit-guest-charlie", "Charlie", "guests"),
      camera("realtimekit-producer-pat", "Pat", "producer"),
      camera("realtimekit-host-rawkode", "Rawkode", "hosts"),
      camera("realtimekit-guest-alice", "Alice", "guests"),
      camera("realtimekit-guest-bob", "Bob", "guests"),
      screen("display-capture-main", "Main display"),
      audio("realtimekit-audio-alice", "Alice audio"),
    ];

    const updated = reduceStudioState(state, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: runtimeSources,
    });

    expect(getSceneLayers(updated, "monologue").filter((layer) => layer.type === "camera").map((layer) => layer.id))
      .toEqual(["monologue-realtimekit-host-rawkode"]);
    expect(getSceneLayers(updated, "guests").filter((layer) => layer.type === "camera").map((layer) => layer.id))
      .toEqual([
        "guests-realtimekit-host-rawkode",
        "guests-realtimekit-guest-charlie",
        "guests-realtimekit-guest-alice",
        "guests-realtimekit-guest-bob",
        "guests-realtimekit-producer-pat",
      ]);
    expect(updated.sources.some((source) => source.id === "source-stage-wash")).toBe(true);
    expect(updated.sources.some((source) => source.id === "source-guest-camera")).toBe(false);
    expect(updated.sources.some((source) => source.id === "realtimekit-audio-alice")).toBe(true);
    expect(updated.activeScreenShareSourceId).toBe("display-capture-main");
    expect(getSceneLayers(updated, "screenshare").find((layer) => layer.type === "screen")).toMatchObject({
      label: "Main display",
      sourceId: "display-capture-main",
    });
  });

  it("recompiles legacy role-slot layers onto stable participant identities", () => {
    const state = createInitialStudioState();
    state.audioMix["source-guest-camera"] = { gain: 0.5, muted: true };
    const stableGuest = camera(
      "source-realtimekit-camera-studio-guest-alice",
      "Alice",
      "guests",
    );

    const updated = reconcileStudioSources(state, [stableGuest], STUDIO_SCENE_DEFINITIONS, {
      authoritativeRuntimeSource: "realtimekit",
    });

    expect(updated.sources.some((source) => source.id === "source-guest-camera")).toBe(false);
    expect(updated.sources).toContainEqual(stableGuest);
    expect(updated.layers.some((layer) => layer.sourceId === "source-guest-camera")).toBe(false);
    expect(updated.layers.some((layer) => layer.sourceId === stableGuest.id)).toBe(true);
    expect(updated.audioMix["source-guest-camera"]).toEqual({ gain: 0.5, muted: true });
  });

  it("updates automatic layouts as sources become muted or disappear", () => {
    const host = camera("participant-host", "Host", "hosts");
    const guest = camera("participant-guest", "Guest", "guests");
    const ready = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, guest],
    });

    expect(getSceneLayers(ready, "guests").find((layer) => layer.id === "guests-participant-host")?.bounds.width)
      .toBe(760);

    const muted = reduceStudioState(ready, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, { ...guest, status: "muted" }],
    });
    const mutedGuest = getSceneLayers(muted, "guests").find((layer) => layer.id === "guests-participant-guest");
    const expandedHost = getSceneLayers(muted, "guests").find((layer) => layer.id === "guests-participant-host");

    expect(mutedGuest?.enabled).toBe(false);
    expect(expandedHost?.bounds.width).toBe(1508);

    const removed = reduceStudioState(muted, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host],
    });

    expect(getSceneLayers(removed, "guests").some((layer) => layer.id === "guests-participant-guest")).toBe(false);
    expect(removed.layers.some((layer) => layer.id === "guests-participant-guest")).toBe(false);
    expect(removed.sources.some((source) => source.id === guest.id)).toBe(false);
  });

  it("reflows new participants around cameras the operator has hidden", () => {
    const host = camera("participant-host", "Host", "hosts");
    const guestA = camera("participant-guest-a", "Guest A", "guests");
    const guestB = camera("participant-guest-b", "Guest B", "guests");
    const sourced = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, guestA, guestB],
    });
    const hidden = reduceStudioState(sourced, {
      type: "layer.toggle",
      layerId: "guests-participant-guest-b",
    });

    const reconciled = reduceStudioState(hidden, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, guestA, guestB, camera("participant-guest-c", "Guest C", "guests")],
    });
    const cameras = getSceneLayers(reconciled, "guests").filter((layer) => layer.type === "camera");
    const enabledCameras = cameras.filter((layer) => layer.enabled);

    expect(cameras.find((layer) => layer.id === "guests-participant-guest-b")?.enabled).toBe(false);
    expect(enabledCameras.map((layer) => layer.id)).toEqual([
      "guests-participant-host",
      "guests-participant-guest-a",
      "guests-participant-guest-c",
    ]);
    expect(enabledCameras.every((layer) => layer.bounds.width === 520 && layer.bounds.height === 560)).toBe(true);
  });

  it("preserves edited layers, scene order, and lifecycle generations", () => {
    const host = camera("participant-host", "Host", "hosts");
    const guestA = camera("participant-guest-a", "Guest A", "guests");
    const guestB = camera("participant-guest-b", "Guest B", "guests");
    const producer = camera("participant-producer", "Producer", "producer");
    const firstSources = [host, guestA, guestB, producer, screen("display-main", "Main display")];
    const sourced = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: firstSources,
    });
    const transitioning = reduceStudioState(sourced, { type: "scene.select", sceneId: "guests" });
    const guests = reduceStudioState(transitioning, {
      type: "stinger.midpoint",
      generation: transitioning.activeStinger?.generation,
    });
    const selected = reduceStudioState(guests, { type: "layer.select", layerId: "guests-participant-guest-a" });
    const positioned = reduceStudioState(selected, {
      type: "layer.bounds.update",
      layerId: "guests-participant-guest-a",
      bounds: { x: 123, y: 234, width: 345, height: 456 },
    });
    const translucent = reduceStudioState(positioned, { type: "layer.opacity.update", value: 0.42 });
    const locked = reduceStudioState(translucent, {
      type: "layer.lock.toggle",
      layerId: "guests-participant-guest-a",
    });
    const reordered = reduceStudioState(locked, {
      type: "layer.move",
      layerId: "guests-lower-third",
      targetLayerId: "guests-participant-guest-a",
      placement: "before",
    });
    const shown = reduceStudioState(reordered, { type: "lowerThird.show" });
    const withStinger = reduceStudioState(shown, { type: "scene.select", sceneId: "screenshare" });
    const activeOverlay = withStinger.activeOverlays["guests-lower-third"];
    const activeStinger = withStinger.activeStinger;
    const lifecycleGeneration = withStinger.lifecycleGeneration;
    const previousHostBounds = getSceneLayers(withStinger, "guests").find(
      (layer) => layer.id === "guests-participant-host",
    )?.bounds;

    const reconciled = reduceStudioState(withStinger, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [
        host,
        { ...guestA, name: "Renamed Guest", label: "Renamed Guest" },
        guestB,
        camera("participant-guest-c", "Guest C", "guests"),
        producer,
        screen("display-main", "Main display"),
      ],
    });
    const editedLayer = reconciled.layers.find((layer) => layer.id === "guests-participant-guest-a");
    const reconciledHostBounds = reconciled.layers.find((layer) => layer.id === "guests-participant-host")?.bounds;
    const guestOrder = getScene(reconciled, "guests")?.layerIds ?? [];

    expect(editedLayer).toMatchObject({
      bounds: { x: 123, y: 234, width: 345, height: 456 },
      label: "Renamed Guest",
      locked: true,
      name: "Renamed Guest",
      opacity: 0.42,
    });
    expect(reconciledHostBounds).not.toEqual(previousHostBounds);
    expect(guestOrder.indexOf("guests-lower-third")).toBeLessThan(
      guestOrder.indexOf("guests-participant-guest-a"),
    );
    expect(guestOrder.indexOf("guests-participant-guest-c")).toBeLessThan(
      guestOrder.indexOf("guests-participant-producer"),
    );
    expect(reconciled.activeOverlays["guests-lower-third"]).toBe(activeOverlay);
    expect(reconciled.activeStinger).toBe(activeStinger);
    expect(reconciled.lifecycleGeneration).toBe(lifecycleGeneration);
  });

  it("keeps a selected screen while present and falls back when it disappears", () => {
    const host = camera("participant-host", "Host", "hosts");
    const displayA = screen("display-a", "Display A");
    const displayB = screen("display-b", "Display B");
    const sourced = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, displayA, displayB],
    });
    const selected = reduceStudioState(sourced, {
      type: "screenShare.source.select",
      sourceId: displayB.id,
      name: displayB.name,
    });

    const preserved = reduceStudioState(selected, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, displayA, displayB],
    });

    expect(preserved.activeScreenShareSourceId).toBe(displayB.id);
    expect(getSceneLayers(preserved, "screenshare").find((layer) => layer.type === "screen")?.sourceId)
      .toBe(displayB.id);

    const removed = reduceStudioState(preserved, {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host],
    });

    expect(removed.activeScreenShareSourceId).toBe("source-host-screen-share");
    expect(getSceneLayers(removed, "screenshare").find((layer) => layer.type === "screen")?.sourceId)
      .toBe("source-host-screen-share");
  });

  it("selects a remaining preview layer when the selected participant disappears", () => {
    const host = camera("participant-host", "Host", "hosts");
    const guest = camera("participant-guest", "Guest", "guests");
    const sourced = reduceStudioState(createInitialStudioState(), {
      type: "sources.reconcile",
      authoritativeRuntimeSource: "realtimekit",
      sources: [host, guest],
    });
    const transitioning = reduceStudioState(sourced, { type: "scene.select", sceneId: "guests" });
    const guests = reduceStudioState(transitioning, {
      type: "stinger.midpoint",
      generation: transitioning.activeStinger?.generation,
    });
    const selected = reduceStudioState(guests, {
      type: "layer.select",
      layerId: "guests-participant-guest",
    });

    const reconciled = reconcileStudioSources(selected, [host], STUDIO_SCENE_DEFINITIONS, {
      authoritativeRuntimeSource: "realtimekit",
    });

    expect(reconciled.selectedLayerId).toBe("guests-lower-third");
    expect(reconciled.layers.some((layer) => layer.id === reconciled.selectedLayerId)).toBe(true);
    expect(selected.layers.some((layer) => layer.id === "guests-participant-guest")).toBe(true);
  });
});

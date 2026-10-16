import { describe, expect, it } from "vitest";
import { createInitialStudioState } from "./seed";
import { reconcileOnStageSourceIds, selectOnStageLayers, setSourceOnStage } from "./sourceAdmission";
import type { StudioLayer, StudioSource } from "../types";
import { getDynamicGridBounds, getScreenshareCameraBounds } from "./layouts";

function source(id: string, type: StudioSource["type"] = "camera"): StudioSource {
  return { id, name: id, type, status: "ready" };
}

function layer(id: string, type: StudioLayer["type"], sourceId?: string): StudioLayer {
  return { id, type, sourceId, name: id, enabled: true, opacity: 1, bounds: { x: 0, y: 0, width: 100, height: 100 } };
}

describe("producer source admission", () => {
  it("requires explicit admission and does not change another source's permission", () => {
    const state = { ...createInitialStudioState(), sources: [source("host"), source("guest"), source("screen", "screen")] };
    expect(state.onStageSourceIds).toEqual([]);
    const admitted = setSourceOnStage(state, "host", true);
    expect(admitted.onStageSourceIds).toEqual(["host"]);
    expect(state.onStageSourceIds).toEqual([]);
    expect(setSourceOnStage(admitted, "host", true)).toBe(admitted);
    expect(setSourceOnStage(admitted, "host", false).onStageSourceIds).toEqual([]);
    expect(setSourceOnStage(state, "missing", true)).toBe(state);
  });

  it("does not treat graphics as contributors", () => {
    const state = { ...createInitialStudioState(), sources: [source("graphic", "graphic")] };
    expect(setSourceOnStage(state, "graphic", true)).toBe(state);
  });

  it("drops departed permissions and never grants a newly arrived source permission", () => {
    expect(reconcileOnStageSourceIds(["host", "guest", "host"], [source("host"), source("new-guest")])).toEqual(["host"]);
    expect(reconcileOnStageSourceIds(undefined, [source("host")])).toEqual([]);
  });

  it("suppresses backstage picture and sound layers even if a saved scene enables them", () => {
    const layers = [
      layer("background", "background"),
      layer("host-camera", "camera", "host"),
      layer("guest-camera", "camera", "guest"),
      layer("guest-screen", "screen", "screen"),
      layer("guest-audio", "audio", "guest"),
      layer("media", "video", "clip"),
      layer("orphan-camera", "camera"),
      layer("caption", "html"),
    ];
    expect(selectOnStageLayers(layers, ["host"]).map((item) => item.id)).toEqual(["background", "host-camera", "caption"]);
    expect(selectOnStageLayers(layers, undefined).map((item) => item.id)).toEqual(["background", "caption"]);
    expect(selectOnStageLayers(layers, ["screen"]).map((item) => item.id)).toEqual(["background", "guest-screen", "caption"]);
  });

  it("fills automatic layouts with admitted cameras without changing saved geometry", () => {
    const resolution = { width: 1920, height: 1080, fps: 30 };
    const host = layer("host", "camera", "host");
    const guest = layer("guest", "camera", "guest");
    const scene = { id: "scene", name: "Scene", layerIds: ["host", "guest"], layout: "dynamic-grid" as const };
    expect(selectOnStageLayers([host, guest], ["host"], scene, resolution)[0].bounds).toEqual(getDynamicGridBounds(1, resolution)[0]);
    expect(host.bounds.width).toBe(100);
    expect(selectOnStageLayers([host, guest], ["host"], { ...scene, layout: "screenshare" }, resolution)[0].bounds).toEqual(getScreenshareCameraBounds(1, resolution)[0]);
    expect(selectOnStageLayers([{ ...host, settings: { studioManualBounds: true } }, guest], ["host"], scene, resolution)[0].bounds).toEqual(host.bounds);
  });
});

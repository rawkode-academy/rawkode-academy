import { describe, expect, it } from "vitest";
import { createInitialStudioState } from "./seed";
import { getHitTestLayerStack, getRailLayerStack, getRenderLayerStack, getSceneLayerStack } from "./layerStack";
import { getScene } from "./studioMachine";

describe("layerStack", () => {
  it("keeps scene stack order bottom-to-top", () => {
    const state = createInitialStudioState();
    const scene = getScene(state, "guests");

    expect(getSceneLayerStack(scene, state.layers).map((layer) => layer.id)).toEqual([
      "guests-stage-light",
      "guests-host-camera",
      "guests-guest-camera",
      "guests-second-guest-camera",
      "guests-producer-camera",
      "guests-lower-third",
    ]);
  });

  it("renders enabled layers bottom-to-top", () => {
    const state = createInitialStudioState();
    const scene = getScene(state, "screenshare");
    const layers = getSceneLayerStack(scene, state.layers);

    expect(getRenderLayerStack(layers).map((layer) => layer.id)).toEqual([
      "screenshare-stage-light",
      "screenshare-screen",
      "screenshare-host-camera",
      "screenshare-guest-camera",
      "screenshare-second-guest-camera",
    ]);
  });

  it("hit-tests and displays layers top-to-bottom", () => {
    const state = createInitialStudioState();
    const scene = getScene(state, "guests");
    const layers = getSceneLayerStack(scene, state.layers);

    expect(getHitTestLayerStack(layers).map((layer) => layer.id)).toEqual([
      "guests-lower-third",
      "guests-second-guest-camera",
      "guests-guest-camera",
      "guests-host-camera",
    ]);
    expect(getRailLayerStack(layers).map((layer) => layer.id)[0]).toBe("guests-lower-third");
  });
});

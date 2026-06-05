import { describe, expect, it } from "vitest";
import type { StudioSource } from "../types";
import { createInitialStudioState } from "./seed";
import { compileScenes, defineScene, layouts, people } from "./scenes/sceneDsl";
import { getScene, getSceneLayers, getSelectedLayer, reduceStudioState } from "./studioMachine";

describe("studioMachine", () => {
  it("seeds the required production run-of-show scenes", () => {
    expect(createInitialStudioState().scenes.map((scene) => scene.name)).toEqual([
      "Intro",
      "Monologue",
      "Guests",
      "Screenshare",
      "Outro",
    ]);
  });

  it("cuts selected scenes directly to program while designing", () => {
    const state = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });

    expect(state.previewSceneId).toBe("monologue");
    expect(state.programSceneId).toBe("monologue");
    expect(getSelectedLayer(state)?.id).toBe("monologue-lower-third");
    expect(state.status).toBe("Monologue on program");
  });

  it("stages scene changes during recording until take", () => {
    const recording = reduceStudioState(createInitialStudioState(), {
      type: "recording.toggle",
    });
    const staged = reduceStudioState(recording, {
      type: "scene.select",
      sceneId: "screenshare",
    });

    expect(staged.phase).toBe("recording");
    expect(staged.previewSceneId).toBe("screenshare");
    expect(staged.programSceneId).toBe("intro");
    expect(staged.status).toBe("Screenshare staged");

    const taken = reduceStudioState(staged, { type: "scene.take" });
    expect(taken.programSceneId).toBe("screenshare");
    expect(taken.status).toBe("Screenshare taken to program");
  });

  it("does not move locked layers", () => {
    const state = reduceStudioState(createInitialStudioState(), {
      type: "layer.bounds.update",
      layerId: "intro-video",
      bounds: { x: 400, y: 300, width: 300, height: 200 },
    });

    expect(state.layers.find((layer) => layer.id === "intro-video")?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("duplicates scenes with independent layer instances", () => {
    const state = reduceStudioState(createInitialStudioState(), {
      type: "scene.duplicate",
      sceneId: "monologue",
    });
    const copiedScene = getScene(state, "monologue-copy");

    expect(copiedScene?.name).toBe("Monologue Copy");
    expect(copiedScene?.layerIds).not.toContain("monologue-lower-third");
    expect(copiedScene?.layerIds.some((id) => id.startsWith("monologue-lower-third-copy"))).toBe(true);
    expect(state.programSceneId).toBe("monologue-copy");
  });

  it("uses scene-owned camera layer instances for monologue and guests layouts", () => {
    const state = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });
    const monologueCamera = getSceneLayers(state, "monologue").find(
      (layer) => layer.sourceId === "source-host-camera",
    );
    const guestsCamera = getSceneLayers(state, "guests").find((layer) => layer.sourceId === "source-host-camera");

    expect(monologueCamera?.id).toBe("monologue-host-camera");
    expect(guestsCamera?.id).toBe("guests-host-camera");
    expect(monologueCamera?.bounds.width).toBeGreaterThan(guestsCamera?.bounds.width ?? 0);
    expect(monologueCamera?.bounds.height).toBeGreaterThan(guestsCamera?.bounds.height ?? 0);
  });

  it("models screenshare as full screen share with small camera overlays", () => {
    const state = createInitialStudioState();
    const screen = getSceneLayers(state, "screenshare").find((layer) => layer.type === "screen");
    const cameras = getSceneLayers(state, "screenshare").filter((layer) => layer.type === "camera");
    const enabledCameras = cameras.filter((layer) => layer.enabled);

    expect(screen?.bounds.width).toBeGreaterThan(1600);
    expect(screen?.bounds.height).toBeGreaterThan(780);
    expect(cameras.map((layer) => layer.id)).toEqual([
      "screenshare-host-camera",
      "screenshare-guest-camera",
      "screenshare-second-guest-camera",
      "screenshare-producer-camera",
    ]);
    expect(enabledCameras).toHaveLength(3);
    expect(enabledCameras.every((camera) => camera.bounds.width < 320 && camera.bounds.height < 220)).toBe(true);
    expect(cameras.find((layer) => layer.id === "screenshare-producer-camera")?.enabled).toBe(false);
  });

  it("expands guests dynamic grid when a camera is hidden", () => {
    const guests = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "guests",
    });
    const twoUp = reduceStudioState(guests, {
      type: "layer.toggle",
      layerId: "guests-second-guest-camera",
    });
    const enabledCameras = getSceneLayers(twoUp, "guests").filter(
      (layer) => layer.type === "camera" && layer.enabled,
    );

    expect(enabledCameras.map((layer) => layer.id)).toEqual(["guests-host-camera", "guests-guest-camera"]);
    expect(enabledCameras.every((layer) => layer.bounds.width === 760)).toBe(true);
    expect(enabledCameras.every((layer) => layer.bounds.height === 620)).toBe(true);
    expect(twoUp.layers.find((layer) => layer.id === "guests-second-guest-camera")?.enabled).toBe(false);
  });

  it("restores guests dynamic grid when a camera is shown again", () => {
    const guests = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "guests",
    });
    const twoUp = reduceStudioState(guests, {
      type: "layer.toggle",
      layerId: "guests-second-guest-camera",
    });
    const threeUp = reduceStudioState(twoUp, {
      type: "layer.toggle",
      layerId: "guests-second-guest-camera",
    });
    const enabledCameras = getSceneLayers(threeUp, "guests").filter(
      (layer) => layer.type === "camera" && layer.enabled,
    );

    expect(enabledCameras).toHaveLength(3);
    expect(enabledCameras.every((layer) => layer.bounds.width === 520)).toBe(true);
    expect(enabledCameras.every((layer) => layer.bounds.height === 560)).toBe(true);
  });

  it("brings producer cameras into role-based grids when they become active", () => {
    const guests = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "guests",
    });
    const fourUp = reduceStudioState(guests, {
      type: "layer.toggle",
      layerId: "guests-producer-camera",
    });
    const enabledCameras = getSceneLayers(fourUp, "guests").filter(
      (layer) => layer.type === "camera" && layer.enabled,
    );

    expect(enabledCameras.map((layer) => layer.id)).toEqual([
      "guests-host-camera",
      "guests-guest-camera",
      "guests-second-guest-camera",
      "guests-producer-camera",
    ]);
    expect(enabledCameras.every((layer) => layer.bounds.width === 798)).toBe(true);
    expect(enabledCameras.every((layer) => layer.bounds.height === 393)).toBe(true);
  });

  it("expands screenshare people overlay when one camera is hidden", () => {
    const screenshare = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "screenshare",
    });
    const oneUp = reduceStudioState(screenshare, {
      type: "layer.toggle",
      layerId: "screenshare-second-guest-camera",
    });
    const enabledCameras = getSceneLayers(oneUp, "screenshare").filter(
      (layer) => layer.type === "camera" && layer.enabled,
    );
    const screen = getSceneLayers(oneUp, "screenshare").find((layer) => layer.type === "screen");

    expect(screen?.bounds.width).toBeGreaterThan(1600);
    expect(enabledCameras.map((layer) => layer.id)).toEqual(["screenshare-host-camera", "screenshare-guest-camera"]);
    expect(enabledCameras.every((layer) => layer.bounds.width === 286)).toBe(true);
    expect(enabledCameras.every((layer) => layer.bounds.height === 176)).toBe(true);
  });

  it("restores screenshare people overlay when a camera is shown again", () => {
    const screenshare = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "screenshare",
    });
    const oneUp = reduceStudioState(screenshare, {
      type: "layer.toggle",
      layerId: "screenshare-second-guest-camera",
    });
    const twoUp = reduceStudioState(oneUp, {
      type: "layer.toggle",
      layerId: "screenshare-second-guest-camera",
    });
    const enabledCameras = getSceneLayers(twoUp, "screenshare").filter(
      (layer) => layer.type === "camera" && layer.enabled,
    );

    expect(enabledCameras).toHaveLength(3);
    expect(enabledCameras.every((layer) => layer.bounds.width === 259)).toBe(true);
    expect(enabledCameras.every((layer) => layer.bounds.height === 162)).toBe(true);
  });

  it("updates the active scene lower third after duplication", () => {
    const copied = reduceStudioState(createInitialStudioState(), {
      type: "scene.duplicate",
      sceneId: "monologue",
    });
    const updatedDraft = reduceStudioState(copied, {
      type: "lowerThird.comment.update",
      value: "Only on the duplicated monologue",
    });
    const shown = reduceStudioState(updatedDraft, { type: "lowerThird.show" });
    const copiedLowerThirdId = getScene(shown, "monologue-copy")?.layerIds.find((id) =>
      id.startsWith("monologue-lower-third-copy"),
    );

    expect(copiedLowerThirdId).toBeDefined();
    expect(shown.selectedLayerId).toBe(copiedLowerThirdId);
    expect(shown.layers.find((layer) => layer.id === copiedLowerThirdId)?.html).toContain(
      "Only on the duplicated monologue",
    );
    expect(shown.layers.find((layer) => layer.id === "monologue-lower-third")?.html).not.toContain(
      "Only on the duplicated monologue",
    );
  });

  it("reorders scene layers and updates z-index for rendering", () => {
    const state = reduceStudioState(
      reduceStudioState(createInitialStudioState(), {
        type: "scene.select",
        sceneId: "guests",
      }),
      {
        type: "layer.reorder",
        layerId: "guests-lower-third",
        direction: "down",
      },
    );
    const scene = getScene(state, "guests");

    expect(scene?.layerIds.indexOf("guests-lower-third")).toBe(4);
    expect(state.layers.find((layer) => layer.id === "guests-lower-third")?.zIndex).toBe(40);
  });

  it("moves layers by drag/drop target placement", () => {
    const state = reduceStudioState(
      reduceStudioState(createInitialStudioState(), {
        type: "scene.select",
        sceneId: "guests",
      }),
      {
        type: "layer.move",
        layerId: "guests-lower-third",
        targetLayerId: "guests-guest-camera",
        placement: "before",
      },
    );
    const scene = getScene(state, "guests");

    expect(scene?.layerIds).toEqual([
      "guests-stage-light",
      "guests-host-camera",
      "guests-lower-third",
      "guests-guest-camera",
      "guests-second-guest-camera",
      "guests-producer-camera",
    ]);
    expect(state.layers.find((layer) => layer.id === "guests-lower-third")?.zIndex).toBe(20);
  });

  it("renders comment input into the active scene lower third layer through an event", () => {
    const monologue = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });
    const withComment = reduceStudioState(
      reduceStudioState(monologue, {
        type: "lowerThird.comment.update",
        value: "Drag this into the programme",
      }),
      { type: "lowerThird.show" },
    );

    expect(withComment.selectedLayerId).toBe("monologue-lower-third");
    expect(withComment.htmlDraft).toContain("Drag this into the programme");
    expect(withComment.layers.find((layer) => layer.id === "monologue-lower-third")?.html).toContain(
      "Drag this into the programme",
    );
  });

  it("defines scenes with role selectors instead of fixed guest identities", () => {
    const state = createInitialStudioState();
    const guestsSceneLayers = getSceneLayers(state, "guests");

    expect(guestsSceneLayers.filter((layer) => layer.type === "camera").map((layer) => layer.id)).toEqual([
      "guests-host-camera",
      "guests-guest-camera",
      "guests-second-guest-camera",
      "guests-producer-camera",
    ]);
    expect(guestsSceneLayers.find((layer) => layer.id === "guests-producer-camera")?.enabled).toBe(false);
  });

  it("pulls newly-added guest cameras into compiled scenes without changing scene code", () => {
    const state = createInitialStudioState();
    const sources: StudioSource[] = [
      ...state.sources,
      {
        id: "source-third-guest-camera",
        name: "Third Guest Camera",
        type: "camera",
        status: "ready",
        roles: ["guests"],
        color: "#b6ff7a",
        label: "Guest 3",
      },
    ];
    const document = compileScenes({
      definitions: [
        defineScene({
          id: "guests",
          name: "Guests",
          transition: "cut",
          layout: layouts.dynamicGrid([
            people.selector("hosts"),
            people.selector("guests"),
            people.selector("producer"),
          ]),
        }),
      ],
      resolution: state.resolution,
      sources,
    });
    const sceneLayers = document.scenes[0].layerIds
      .map((id) => document.layers.find((layer) => layer.id === id))
      .filter(Boolean);

    expect(sceneLayers.filter((layer) => layer?.type === "camera").map((layer) => layer?.id)).toEqual([
      "guests-host-camera",
      "guests-guest-camera",
      "guests-second-guest-camera",
      "guests-third-guest-camera",
      "guests-producer-camera",
    ]);
  });
});

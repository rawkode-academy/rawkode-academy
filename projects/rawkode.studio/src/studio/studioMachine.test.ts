import { describe, expect, it } from "vitest";
import type { StudioSource } from "../types";
import { createInitialStudioState } from "./seed";
import { actions, compileScenes, defineScene, layouts, media, overlays, people, transitions } from "./scenes/sceneDsl";
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

  it("seeds each scene with a distinct outgoing stinger", () => {
    expect(createInitialStudioState().scenes.map((scene) => [scene.id, scene.stinger])).toEqual([
      [
        "intro",
        {
          direction: "left",
          durationSeconds: 2,
          kind: "motion-transition",
          transition: "slide",
        },
      ],
      [
        "monologue",
        {
          durationSeconds: 2,
          kind: "motion-transition",
          transition: "fade",
        },
      ],
      [
        "guests",
        {
          axis: "y",
          durationSeconds: 2,
          kind: "motion-transition",
          transition: "flip",
        },
      ],
      [
        "screenshare",
        {
          durationSeconds: 2,
          kind: "motion-transition",
          transition: "typewriter",
        },
      ],
      [
        "outro",
        {
          direction: "right",
          durationSeconds: 2,
          kind: "motion-transition",
          transition: "cube-spin",
        },
      ],
    ]);
  });

  it("switches selected scenes to program at stinger midpoint while designing", () => {
    const transitioning = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });

    expect(transitioning.previewSceneId).toBe("monologue");
    expect(transitioning.programSceneId).toBe("intro");
    expect(transitioning.activeStinger).toMatchObject({
      fromSceneId: "intro",
      toSceneId: "monologue",
    });
    expect(getSelectedLayer(transitioning)?.id).toBe("monologue-lower-third");
    expect(transitioning.status).toBe("Monologue transition started");

    const midpoint = reduceStudioState(transitioning, { type: "stinger.midpoint" });
    expect(midpoint.programSceneId).toBe("monologue");
    expect(midpoint.activeStinger).toBeDefined();
    expect(midpoint.status).toBe("Monologue on program");

    expect(reduceStudioState(midpoint, { type: "stinger.finished" }).activeStinger).toBeUndefined();
  });

  it("keeps recording scene changes on the old program until stinger midpoint", () => {
    const recording = reduceStudioState(createInitialStudioState(), {
      type: "recording.toggle",
    });
    const transitioning = reduceStudioState(recording, {
      type: "scene.select",
      sceneId: "screenshare",
    });

    expect(transitioning.phase).toBe("recording");
    expect(transitioning.previewSceneId).toBe("screenshare");
    expect(transitioning.programSceneId).toBe("intro");
    expect(transitioning.status).toBe("Screenshare transition started");

    const midpoint = reduceStudioState(transitioning, { type: "stinger.midpoint" });
    expect(midpoint.programSceneId).toBe("screenshare");
    expect(midpoint.status).toBe("Screenshare on program");
  });

  it("compiles Remotion scenes and motion-transition stingers from TypeScript scene definitions", () => {
    const state = createInitialStudioState();
    const document = compileScenes({
      definitions: [
        defineScene({
          id: "intro",
          name: "Intro",
          transition: "fade",
          stinger: transitions.fade(0.9),
          layout: layouts.remotion("rawkode-intro", {
            title: "Rawkode Live",
            subtitle: "Composable cloud native systems",
          }),
        }),
        defineScene({
          id: "monologue",
          name: "Monologue",
          transition: "cut",
          stinger: transitions.slide("left", 0.35),
          layout: layouts.solo(people.selector("hosts")),
        }),
      ],
      resolution: state.resolution,
      sources: state.sources,
    });

    expect(document.scenes[0].stinger).toEqual({
      kind: "motion-transition",
      transition: "fade",
      durationSeconds: 0.9,
    });
    expect(document.layers.find((layer) => layer.id === "intro-remotion")).toMatchObject({
      id: "intro-remotion",
      name: "Intro",
      type: "remotion",
      sourceId: "source-rawkode-intro",
      settings: {
        remotion: {
          compositionId: "rawkode-intro",
          title: "Rawkode Live",
          subtitle: "Composable cloud native systems",
        },
      },
    });
    expect(document.scenes[1].stinger).toEqual({
      direction: "left",
      kind: "motion-transition",
      transition: "slide",
      durationSeconds: 0.35,
    });
  });

  it("activates a scene stinger when switching away from the current program scene", () => {
    const initial = createInitialStudioState();
    const state = {
      ...initial,
      scenes: initial.scenes.map((scene) =>
        scene.id === "intro"
          ? {
              ...scene,
              stinger: {
                kind: "motion-transition" as const,
                transition: "wipe" as const,
                direction: "right" as const,
                durationSeconds: 0.9,
              },
            }
          : scene,
      ),
    };
    const switched = reduceStudioState(state, {
      type: "scene.select",
      sceneId: "monologue",
    });

    expect(switched.programSceneId).toBe("intro");
    expect(switched.activeStinger).toEqual({
      fromSceneId: "intro",
      toSceneId: "monologue",
      effect: {
        kind: "motion-transition",
        transition: "wipe",
        direction: "right",
        durationSeconds: 0.9,
      },
    });

    const midpoint = reduceStudioState(switched, { type: "stinger.midpoint" });
    expect(midpoint.programSceneId).toBe("monologue");
    expect(midpoint.activeStinger).toEqual(switched.activeStinger);
    expect(reduceStudioState(midpoint, { type: "stinger.finished" }).activeStinger).toBeUndefined();
  });

  it("does not move locked layers", () => {
    const state = reduceStudioState(createInitialStudioState(), {
      type: "layer.bounds.update",
      layerId: "intro-remotion",
      bounds: { x: 400, y: 300, width: 300, height: 200 },
    });

    expect(state.layers.find((layer) => layer.id === "intro-remotion")?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("runs media end hooks that change scenes", () => {
    const initial = createInitialStudioState();
    const state = {
      ...initial,
      layers: initial.layers.map((layer) =>
        layer.id === "intro-remotion"
          ? {
              ...layer,
              settings: {
                ...layer.settings,
                media: {
                  onEnd: [actions.changeScene("monologue")],
                },
              },
            }
          : layer,
      ),
    };
    const changed = reduceStudioState(state, {
      type: "media.finished",
      layerId: "intro-remotion",
    });

    expect(changed.previewSceneId).toBe("monologue");
    expect(changed.programSceneId).toBe("intro");
    expect(changed.activeStinger?.toSceneId).toBe("monologue");
    expect(changed.status).toBe("Intro finished; changing to Monologue");

    const midpoint = reduceStudioState(changed, { type: "stinger.midpoint" });
    expect(midpoint.programSceneId).toBe("monologue");
    expect(midpoint.status).toBe("Monologue on program");
  });

  it("queues named hooks from media end actions", () => {
    const initial = createInitialStudioState();
    const state = {
      ...initial,
      layers: initial.layers.map((layer) =>
        layer.id === "intro-remotion"
          ? {
              ...layer,
              settings: {
                ...layer.settings,
                media: {
                  onEnd: [actions.runHook("fade-intro-audio")],
                },
              },
            }
          : layer,
      ),
    };
    const updated = reduceStudioState(state, {
      type: "media.finished",
      layerId: "intro-remotion",
    });

    expect(updated.lastHookId).toBe("fade-intro-audio");
    expect(updated.status).toBe("Intro finished; hook fade-intro-audio queued");
  });

  it("compiles audio media layers with typed finish hooks", () => {
    const state = createInitialStudioState();
    const sources: StudioSource[] = [
      ...state.sources,
      {
        id: "source-intro-bed",
        name: "Intro Bed",
        type: "audio",
        status: "ready",
      },
    ];
    const document = compileScenes({
      definitions: [
        defineScene({
          id: "intro",
          name: "Intro",
          transition: "fade",
          layout: layouts.remotion("rawkode-intro", {
            title: "Rawkode Live",
            onEnd: actions.changeScene("monologue"),
          }),
          media: [
            media.audio("intro-bed", "source-intro-bed", {
              name: "Intro Bed",
              onEnd: actions.runHook("duck-background-music"),
            }),
          ],
        }),
      ],
      resolution: state.resolution,
      sources,
    });
    const remotionLayer = document.layers.find((layer) => layer.id === "intro-remotion");
    const audio = document.layers.find((layer) => layer.id === "intro-intro-bed");

    expect(remotionLayer?.settings?.media?.onEnd).toEqual([actions.changeScene("monologue")]);
    expect(remotionLayer?.settings?.remotion).toMatchObject({
      compositionId: "rawkode-intro",
      title: "Rawkode Live",
    });
    expect(audio).toMatchObject({
      id: "intro-intro-bed",
      name: "Intro Bed",
      type: "audio",
      sourceId: "source-intro-bed",
      locked: true,
    });
    expect(audio?.settings?.media?.onEnd).toEqual([actions.runHook("duck-background-music")]);
  });

  it("compiles lower-third enter, visible, and exit timing from scene code", () => {
    const state = createInitialStudioState();
    const document = compileScenes({
      definitions: [
        defineScene({
          id: "monologue",
          name: "Monologue",
          transition: "cut",
          layout: layouts.solo(people.selector("hosts"), {
            lowerThird: overlays.lowerThird({
              enter: transitions.fade(0.22),
              visibleSeconds: 9,
              exit: transitions.fade(0.18),
            }),
          }),
        }),
      ],
      resolution: state.resolution,
      sources: state.sources,
    });
    const lowerThird = document.layers.find((layer) => layer.id === "monologue-lower-third");

    expect(lowerThird?.settings?.overlay).toEqual({
      role: "lower-third",
      lifecycle: {
        enter: {
          kind: "motion-transition",
          transition: "fade",
          durationSeconds: 0.22,
        },
        visibleSeconds: 9,
        exit: {
          kind: "motion-transition",
          transition: "fade",
          durationSeconds: 0.18,
        },
      },
    });
  });

  it("compiles hidden lower-third layers for Remotion scenes", () => {
    const state = createInitialStudioState();
    const introLayers = getSceneLayers(state, "intro");
    const outroLayers = getSceneLayers(state, "outro");

    expect(introLayers.map((layer) => layer.id)).toEqual(["intro-remotion", "intro-lower-third"]);
    expect(outroLayers.map((layer) => layer.id)).toEqual(["outro-remotion", "outro-lower-third"]);
    expect(introLayers.find((layer) => layer.id === "intro-lower-third")).toMatchObject({
      enabled: false,
      sourceId: "source-lower-third",
      type: "html",
    });
    expect(outroLayers.find((layer) => layer.id === "outro-lower-third")).toMatchObject({
      enabled: false,
      sourceId: "source-lower-third",
      type: "html",
    });
  });

  it("offers the production overlay transition catalogue as scene-code helpers", () => {
    expect(transitions.slide("left", 0.25)).toEqual({
      direction: "left",
      kind: "motion-transition",
      transition: "slide",
      durationSeconds: 0.25,
    });
    expect(transitions.fade(0.2)).toEqual({
      kind: "motion-transition",
      transition: "fade",
      durationSeconds: 0.2,
    });
    expect(transitions.flip("y", 0.34)).toEqual({
      axis: "y",
      kind: "motion-transition",
      transition: "flip",
      durationSeconds: 0.34,
    });
    expect(transitions.typewriter(0.8)).toEqual({
      kind: "motion-transition",
      transition: "typewriter",
      durationSeconds: 0.8,
    });
    expect(transitions.cubeSpin("right", 0.45)).toEqual({
      direction: "right",
      kind: "motion-transition",
      transition: "cube-spin",
      durationSeconds: 0.45,
    });
    expect(transitions.wipe("up", 0.3)).toEqual({
      direction: "up",
      kind: "motion-transition",
      transition: "wipe",
      durationSeconds: 0.3,
    });
    expect(transitions.scale(0.24)).toEqual({
      kind: "motion-transition",
      transition: "scale",
      durationSeconds: 0.24,
    });
    expect(transitions.blur(0.26)).toEqual({
      kind: "motion-transition",
      transition: "blur",
      durationSeconds: 0.26,
    });
    expect(transitions.glitch(0.3)).toEqual({
      kind: "motion-transition",
      transition: "glitch",
      durationSeconds: 0.3,
    });
    expect(transitions.pop(0.18)).toEqual({
      kind: "motion-transition",
      transition: "pop",
      durationSeconds: 0.18,
    });
  });

  it("tracks lower-third overlay phases until the exit transition completes", () => {
    const monologue = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });
    const shown = reduceStudioState(
      reduceStudioState(monologue, {
        type: "lowerThird.comment.update",
        value: "Show this comment",
      }),
      { type: "lowerThird.show" },
    );

    expect(shown.activeOverlays["monologue-lower-third"]).toMatchObject({
      layerId: "monologue-lower-third",
      phase: "entering",
      lifecycle: {
        enter: {
          direction: "up",
          kind: "motion-transition",
          transition: "slide",
          durationSeconds: 0.22,
        },
        visibleSeconds: 8,
      },
    });

    const visible = reduceStudioState(shown, {
      type: "overlay.entered",
      layerId: "monologue-lower-third",
    });
    expect(visible.activeOverlays["monologue-lower-third"]?.phase).toBe("visible");

    const exiting = reduceStudioState(visible, {
      type: "overlay.expire",
      layerId: "monologue-lower-third",
    });
    expect(exiting.activeOverlays["monologue-lower-third"]?.phase).toBe("exiting");

    const hidden = reduceStudioState(exiting, {
      type: "overlay.exited",
      layerId: "monologue-lower-third",
    });
    expect(hidden.activeOverlays["monologue-lower-third"]).toBeUndefined();
    expect(hidden.layers.find((layer) => layer.id === "monologue-lower-third")?.enabled).toBe(false);
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
    expect(screen?.sourceId).toBe("source-host-screen-share");
    expect(state.activeScreenShareSourceId).toBe("source-host-screen-share");
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

  it("switches the screenshare scene to a runtime captured screen source", () => {
    const state = reduceStudioState(createInitialStudioState(), {
      type: "screenShare.source.select",
      sourceId: "source-runtime-screen-1",
      name: "Guest laptop",
    });
    const screen = getSceneLayers(state, "screenshare").find((layer) => layer.type === "screen");

    expect(state.activeScreenShareSourceId).toBe("source-runtime-screen-1");
    expect(screen).toMatchObject({
      label: "Guest laptop",
      sourceId: "source-runtime-screen-1",
    });
    expect(state.status).toBe("Guest laptop selected");
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

  it("reorders scene layers by updating the canonical layer order", () => {
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

  it("renders lower thirds into fullscreen video scenes", () => {
    const introComment = reduceStudioState(
      reduceStudioState(createInitialStudioState(), {
        type: "lowerThird.comment.update",
        value: "Opening question from chat",
      }),
      { type: "lowerThird.show" },
    );
    const outro = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "outro",
    });
    const outroComment = reduceStudioState(
      reduceStudioState(outro, {
        type: "lowerThird.comment.update",
        value: "Final audience note",
      }),
      { type: "lowerThird.show" },
    );

    expect(introComment.selectedLayerId).toBe("intro-lower-third");
    expect(introComment.layers.find((layer) => layer.id === "intro-lower-third")).toMatchObject({
      enabled: true,
      type: "html",
    });
    expect(introComment.layers.find((layer) => layer.id === "intro-lower-third")?.html).toContain(
      "Opening question from chat",
    );
    expect(outroComment.selectedLayerId).toBe("outro-lower-third");
    expect(outroComment.layers.find((layer) => layer.id === "outro-lower-third")).toMatchObject({
      enabled: true,
      type: "html",
    });
    expect(outroComment.layers.find((layer) => layer.id === "outro-lower-third")?.html).toContain(
      "Final audience note",
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

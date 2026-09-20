import { describe, expect, it } from "vitest";
import { createInitialStudioState } from "./seed";
import { reduceStudioState } from "./studioMachine";

function moveSceneToProgram(sceneId: string) {
  const staged = reduceStudioState(createInitialStudioState(), {
    type: "scene.select",
    sceneId,
  });
  const transitioning = reduceStudioState(staged, { type: "scene.take" });
  const generation = transitioning.activeStinger?.generation;

  expect(generation).toEqual(expect.any(Number));

  return reduceStudioState(transitioning, {
    type: "stinger.midpoint",
    generation,
  });
}

describe("studioMachine lifecycle guards", () => {
  it("does not interrupt an in-flight stinger with another preview selection", () => {
    const staged = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });
    const transitioning = reduceStudioState(staged, { type: "scene.take" });
    const staleGeneration = transitioning.activeStinger?.generation;

    const ignored = reduceStudioState(transitioning, {
      type: "scene.select",
      sceneId: "intro",
    });

    expect(ignored).toBe(transitioning);
    expect(ignored.previewSceneId).toBe("monologue");
    expect(ignored.programSceneId).toBe("intro");
    expect(ignored.activeStinger?.generation).toBe(staleGeneration);
  });

  it("ignores callbacks from an older stinger generation", () => {
    const firstStaged = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });
    const first = reduceStudioState(firstStaged, { type: "scene.take" });
    const firstGeneration = first.activeStinger?.generation;
    const firstMidpoint = reduceStudioState(first, {
      type: "stinger.midpoint",
      generation: firstGeneration,
    });
    const firstFinished = reduceStudioState(firstMidpoint, {
      type: "stinger.finished",
      generation: firstGeneration,
    });
    const secondStaged = reduceStudioState(firstFinished, {
      type: "scene.select",
      sceneId: "guests",
    });
    const second = reduceStudioState(secondStaged, { type: "scene.take" });
    const secondGeneration = second.activeStinger?.generation;

    expect(secondGeneration).toBeGreaterThan(firstGeneration ?? 0);
    expect(
      reduceStudioState(second, {
        type: "stinger.midpoint",
        generation: firstGeneration,
      }),
    ).toBe(second);

    const midpoint = reduceStudioState(second, {
      type: "stinger.midpoint",
      generation: secondGeneration,
    });
    expect(midpoint.programSceneId).toBe("guests");
    expect(
      reduceStudioState(midpoint, {
        type: "stinger.finished",
        generation: firstGeneration,
      }),
    ).toBe(midpoint);
    expect(
      reduceStudioState(midpoint, {
        type: "stinger.finished",
        generation: secondGeneration,
      }).activeStinger,
    ).toBeUndefined();
  });

  it("keeps generation-less stinger callbacks backward compatible", () => {
    const staged = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });
    const transitioning = reduceStudioState(staged, { type: "scene.take" });

    const midpoint = reduceStudioState(transitioning, { type: "stinger.midpoint" });

    expect(midpoint.programSceneId).toBe("monologue");
    expect(reduceStudioState(midpoint, { type: "stinger.finished" }).activeStinger).toBeUndefined();
  });

  it("ignores stale and out-of-order overlay callbacks", () => {
    const monologue = moveSceneToProgram("monologue");
    const first = reduceStudioState(monologue, { type: "lowerThird.show" });
    const firstOverlay = first.activeOverlays["monologue-lower-third"];
    const second = reduceStudioState(first, { type: "lowerThird.show" });
    const secondOverlay = second.activeOverlays["monologue-lower-third"];

    expect(secondOverlay?.generation).toBeGreaterThan(firstOverlay?.generation ?? 0);
    expect(
      reduceStudioState(second, {
        type: "overlay.entered",
        layerId: "monologue-lower-third",
        generation: firstOverlay?.generation,
      }),
    ).toBe(second);
    expect(
      reduceStudioState(second, {
        type: "overlay.exited",
        layerId: "monologue-lower-third",
        generation: secondOverlay?.generation,
      }),
    ).toBe(second);

    const visible = reduceStudioState(second, {
      type: "overlay.entered",
      layerId: "monologue-lower-third",
      generation: secondOverlay?.generation,
    });
    expect(
      reduceStudioState(visible, {
        type: "overlay.expire",
        layerId: "monologue-lower-third",
        generation: firstOverlay?.generation,
      }),
    ).toBe(visible);

    const exiting = reduceStudioState(visible, {
      type: "overlay.expire",
      layerId: "monologue-lower-third",
      generation: secondOverlay?.generation,
    });
    expect(exiting.activeOverlays["monologue-lower-third"]?.phase).toBe("exiting");
    expect(
      reduceStudioState(exiting, {
        type: "overlay.exited",
        layerId: "monologue-lower-third",
        generation: firstOverlay?.generation,
      }),
    ).toBe(exiting);
  });

  it("does not let overlay exit events disable unrelated layers", () => {
    const state = createInitialStudioState();

    const updated = reduceStudioState(state, {
      type: "overlay.exited",
      layerId: "intro-remotion",
    });

    expect(updated).toBe(state);
    expect(updated.layers.find((layer) => layer.id === "intro-remotion")?.enabled).toBe(true);
  });

  it("clears and hides the program lower third", () => {
    const monologue = moveSceneToProgram("monologue");
    const shown = reduceStudioState(
      reduceStudioState(monologue, {
        type: "lowerThird.comment.update",
        value: "Temporary comment",
      }),
      { type: "lowerThird.show" },
    );

    const cleared = reduceStudioState(shown, { type: "lowerThird.clear" });
    const layer = cleared.layers.find((candidate) => candidate.id === "monologue-lower-third");

    expect(cleared.lowerThird.comment).toBe("");
    expect(cleared.activeOverlays["monologue-lower-third"]).toBeUndefined();
    expect(cleared.htmlDraft).toBe("");
    expect(cleared.status).toBe("Lower third cleared");
    expect(layer).toMatchObject({ enabled: false, html: "" });
  });

  it("shows lower thirds on the program scene while another scene is staged", () => {
    const transitioning = reduceStudioState(createInitialStudioState(), {
      type: "scene.select",
      sceneId: "monologue",
    });

    const shown = reduceStudioState(transitioning, { type: "lowerThird.show" });

    expect(shown.activeOverlays["intro-lower-third"]).toBeDefined();
    expect(shown.activeOverlays["monologue-lower-third"]).toBeUndefined();
    expect(shown.layers.find((layer) => layer.id === "intro-lower-third")?.enabled).toBe(true);
  });

  it("rejects non-finite opacity and bounds updates", () => {
    const monologue = moveSceneToProgram("monologue");
    const selected = reduceStudioState(monologue, {
      type: "layer.select",
      layerId: "monologue-host-camera",
    });

    expect(
      reduceStudioState(selected, {
        type: "layer.opacity.update",
        value: Number.NaN,
      }),
    ).toBe(selected);
    expect(
      reduceStudioState(selected, {
        type: "layer.bounds.patch",
        key: "x",
        value: Number.POSITIVE_INFINITY,
      }),
    ).toBe(selected);
    expect(
      reduceStudioState(selected, {
        type: "layer.bounds.update",
        layerId: "monologue-host-camera",
        bounds: { x: Number.NaN, y: 0, width: 100, height: 100 },
      }),
    ).toBe(selected);
  });

  it("does not report a successful position update for a locked layer", () => {
    const state = createInitialStudioState();

    const updated = reduceStudioState(state, {
      type: "layer.bounds.update",
      layerId: "intro-remotion",
      bounds: { x: 400, y: 300, width: 300, height: 200 },
    });

    expect(updated).toBe(state);
    expect(updated.status).toBe("Intro on program");
  });
});

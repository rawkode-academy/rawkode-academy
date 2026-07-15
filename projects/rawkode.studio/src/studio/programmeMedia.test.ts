import { describe, expect, it } from "vitest";
import type { CanvasResolution, StudioLayer, StudioSource } from "../types";
import {
  deriveProgrammeLayers,
  getProgrammeMediaReadiness,
  OPERATOR_SOURCE_ID,
} from "./programmeMedia";
import { createInitialStudioState } from "./seed";
import { getScene, getSceneLayers } from "./studioMachine";

const resolution: CanvasResolution = { width: 1920, height: 1080, fps: 30 };
const cameraBounds = { x: 0, y: 0, width: 640, height: 360 };

describe("deriveProgrammeLayers", () => {
  it("replaces seeded people with the live operator and selected guests", () => {
    const layers = [
      cameraLayer("host-slot", "source-host-camera"),
      cameraLayer("guest-slot", "source-guest-camera"),
      cameraLayer("seeded-second-guest", "source-second-guest-camera"),
    ];
    const operator = source(OPERATOR_SOURCE_ID, "Operator", "producer");
    const guest = source("source-guest-camera", "Live guest", "guest");
    const streams = new Map<string, MediaStream>([
      [operator.id, mediaStream({ video: [track("operator-video", "video")] })],
      [guest.id, mediaStream({ video: [track("guest-video", "video")] })],
    ]);

    const derived = deriveProgrammeLayers({
      layers,
      mediaStreams: streams,
      resolution,
      runtimeSources: [operator, guest],
    }).filter((layer) => layer.type === "camera");

    expect(derived.map((layer) => layer.sourceId)).toEqual([
      OPERATOR_SOURCE_ID,
      "source-guest-camera",
    ]);
    expect(derived.map((layer) => layer.label)).toEqual(["Operator", "Live guest"]);
    expect(derived.every((layer) => layer.enabled)).toBe(true);
    expect(derived[0]?.bounds).not.toEqual(cameraBounds);
  });

  it("removes seeded camera and screen placeholders when their tracks are absent", () => {
    const layers = [
      cameraLayer("host-slot", "source-host-camera"),
      screenLayer("screen-slot", "source-host-screen-share"),
      backgroundLayer(),
    ];

    const derived = deriveProgrammeLayers({
      layers,
      mediaStreams: new Map(),
      resolution,
      runtimeSources: [],
    });

    expect(derived).toEqual([backgroundLayer()]);
  });

  it("updates the screen source as live screen-share tracks change", () => {
    const first = source("screen-first", "First screen", "screen");
    const second = source("screen-second", "Second screen", "screen");
    const layers = [screenLayer("screen-slot", first.id)];
    const streams = new Map<string, MediaStream>([
      [first.id, mediaStream({ video: [track("first", "video", "ended")] })],
      [second.id, mediaStream({ video: [track("second", "video")] })],
    ]);

    const derived = deriveProgrammeLayers({
      activeScreenShareSourceId: first.id,
      layers,
      mediaStreams: streams,
      resolution,
      runtimeSources: [first, second],
    });

    expect(derived[0]).toMatchObject({
      label: "Second screen",
      sourceId: second.id,
    });
  });
});

describe("getProgrammeMediaReadiness", () => {
  it.each(["intro", "outro"])(
    "allows the renderable %s scene without media sources",
    (sceneId) => {
      const state = createInitialStudioState();
      const readiness = getProgrammeMediaReadiness({
        layers: getSceneLayers(state, sceneId),
        selectedSceneExists: Boolean(getScene(state, sceneId)),
      });

      expect(readiness).toEqual({ ready: true, reason: "", sourceIds: [] });
    },
  );

  it("allows a camera scene after its unavailable camera is removed", () => {
    const state = createInitialStudioState();
    const layers = deriveProgrammeLayers({
      layers: getSceneLayers(state, "monologue"),
      mediaStreams: new Map(),
      resolution,
      runtimeSources: [],
    });

    expect(layers.some((layer) => layer.type === "camera")).toBe(false);
    expect(getProgrammeMediaReadiness({
      layers,
      selectedSceneExists: true,
    })).toEqual({ ready: true, reason: "", sourceIds: [] });
  });

  it("allows the screenshare scene without an active screen share", () => {
    const state = createInitialStudioState();
    const layers = deriveProgrammeLayers({
      layers: getSceneLayers(state, "screenshare"),
      mediaStreams: new Map(),
      resolution,
      runtimeSources: [],
    });

    expect(layers.some((layer) => layer.type === "screen")).toBe(false);
    expect(getProgrammeMediaReadiness({
      layers,
      selectedSceneExists: true,
    })).toEqual({ ready: true, reason: "", sourceIds: [] });
  });

  it("keeps selected media source IDs without requiring their tracks", () => {
    expect(getProgrammeMediaReadiness({
      layers: [cameraLayer("operator", OPERATOR_SOURCE_ID)],
      selectedSceneExists: true,
    })).toEqual({
      ready: true,
      reason: "",
      sourceIds: [OPERATOR_SOURCE_ID],
    });
  });

  it("blocks when the selected scene does not exist", () => {
    expect(getProgrammeMediaReadiness({
      layers: [],
      selectedSceneExists: false,
    })).toEqual({
      ready: false,
      reason: "Select a scene before publishing.",
      sourceIds: [],
    });
  });
});

function cameraLayer(id: string, sourceId: string): StudioLayer {
  return {
    id,
    name: id,
    type: "camera",
    sourceId,
    enabled: true,
    opacity: 1,
    bounds: cameraBounds,
  };
}

function screenLayer(id: string, sourceId: string): StudioLayer {
  return {
    ...cameraLayer(id, sourceId),
    type: "screen",
  };
}

function backgroundLayer(): StudioLayer {
  return {
    ...cameraLayer("background", "stage"),
    type: "background",
  };
}

function source(id: string, name: string, type: "guest" | "producer" | "screen"): StudioSource {
  return {
    id,
    name,
    label: name,
    type: type === "screen" ? "screen" : "camera",
    status: "ready",
    roles: type === "guest" ? ["guests"] : type === "producer" ? ["producer"] : undefined,
  };
}

function mediaStream({
  audio = [],
  video = [],
}: {
  audio?: MediaStreamTrack[];
  video?: MediaStreamTrack[];
}): MediaStream {
  return {
    getAudioTracks: () => audio,
    getVideoTracks: () => video,
  } as MediaStream;
}

function track(
  id: string,
  kind: MediaStreamTrack["kind"],
  readyState: MediaStreamTrackState = "live",
): MediaStreamTrack {
  return {
    enabled: true,
    id,
    kind,
    muted: false,
    readyState,
  } as MediaStreamTrack;
}

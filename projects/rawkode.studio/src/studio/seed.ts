import { buildLowerThirdHtml } from "../lowerThird";
import type { CanvasResolution, StudioSource, StudioState } from "../types";
import {
  compileScenes,
  defineScene,
  layouts,
  overlays,
  people,
  transitions,
  type SceneDefinition,
} from "./scenes/sceneDsl";

export const STUDIO_SCENE_DEFINITIONS: SceneDefinition[] = [
  defineScene({
    id: "intro",
    name: "Intro",
    stinger: transitions.slide("left", 2),
    transition: "fade",
    layout: layouts.remotion("rawkode-intro", {
      title: "Rawkode Live",
      subtitle: "Composable cloud native systems",
      lowerThird: overlays.lowerThird({
        enabled: false,
        enter: transitions.slide("up", 0.22),
        visibleSeconds: 8,
        exit: transitions.fade(0.16),
      }),
    }),
  }),
  defineScene({
    id: "monologue",
    name: "Monologue",
    stinger: transitions.fade(2),
    transition: "cut",
    layout: layouts.solo(people.selector("hosts"), {
      lowerThird: overlays.lowerThird({
        enter: transitions.slide("up", 0.22),
        visibleSeconds: 8,
        exit: transitions.fade(0.16),
      }),
    }),
  }),
  defineScene({
    id: "guests",
    name: "Guests",
    stinger: transitions.flip("y", 2),
    transition: "cut",
    layout: layouts.dynamicGrid(
      [people.selector("hosts"), people.selector("guests"), people.selector("producer")],
      {
        lowerThird: overlays.lowerThird({
          enter: transitions.slide("up", 0.22),
          visibleSeconds: 10,
          exit: transitions.fade(0.16),
        }),
      },
    ),
  }),
  defineScene({
    id: "screenshare",
    name: "Screenshare",
    stinger: transitions.typewriter(2),
    transition: "cut",
    layout: layouts.screenshare(
      "source-host-screen-share",
      [people.selector("hosts"), people.selector("guests"), people.selector("producer")],
      {
        lowerThird: overlays.lowerThird({
          enabled: false,
          enter: transitions.slide("up", 0.22),
          visibleSeconds: 8,
          exit: transitions.fade(0.16),
        }),
      },
    ),
  }),
  defineScene({
    id: "outro",
    name: "Outro",
    stinger: transitions.cubeSpin("right", 2),
    transition: "fade",
    layout: layouts.remotion("rawkode-outro", {
      title: "Thanks for watching",
      subtitle: "Rawkode Live",
      lowerThird: overlays.lowerThird({
        enabled: false,
        enter: transitions.slide("up", 0.22),
        visibleSeconds: 8,
        exit: transitions.fade(0.16),
      }),
    }),
  }),
];

export function createInitialStudioState(): StudioState {
  const resolution: CanvasResolution = {
    width: 1920,
    height: 1080,
    fps: 30,
  };
  const lowerThirdHtml = buildLowerThirdHtml("Rawkode Live", "Composable cloud native systems");
  const sources = createInitialSources();
  const document = compileScenes({
    definitions: STUDIO_SCENE_DEFINITIONS,
    lowerThirdHtml,
    resolution,
    sources,
  });

  return {
    resolution,
    activeScreenShareSourceId: "source-host-screen-share",
    audioMix: {},
    phase: "designing",
    sources,
    scenes: document.scenes,
    layers: document.layers,
    previewSceneId: "intro",
    programSceneId: "intro",
    selectedLayerId: "intro-remotion",
    htmlDraft: "",
    lowerThird: {
      speaker: "Rawkode Live",
      comment: "Composable cloud native systems",
    },
    activeOverlays: {},
    isPlaying: true,
    isRecording: false,
    status: "Intro on program",
  };
}

function createInitialSources(): StudioSource[] {
  return [
    {
      id: "source-rawkode-intro",
      name: "Rawkode Intro",
      type: "remotion",
      status: "ready",
    },
    {
      id: "source-rawkode-outro",
      name: "Rawkode Outro",
      type: "remotion",
      status: "ready",
    },
    {
      id: "source-stage-wash",
      name: "Stage Wash",
      type: "graphic",
      status: "ready",
    },
    {
      id: "source-host-camera",
      name: "Host Camera",
      type: "camera",
      status: "ready",
      roles: ["hosts"],
      color: "#39d5c5",
      label: "Rawkode",
    },
    {
      id: "source-guest-camera",
      name: "Guest Camera",
      type: "camera",
      status: "ready",
      roles: ["guests"],
      color: "#ff9167",
      label: "Guest",
    },
    {
      id: "source-second-guest-camera",
      name: "Second Guest Camera",
      type: "camera",
      status: "ready",
      roles: ["guests"],
      color: "#7688ff",
      label: "Guest 2",
    },
    {
      id: "source-producer-camera",
      name: "Producer Camera",
      type: "camera",
      status: "muted",
      roles: ["producer"],
      color: "#ffb26f",
      label: "Producer",
    },
    {
      id: "source-host-screen-share",
      name: "Screen Share",
      type: "screen",
      status: "missing",
      color: "#39d5c5",
    },
    {
      id: "source-lower-third",
      name: "Lower Third Comment",
      type: "comment",
      status: "ready",
    },
  ];
}

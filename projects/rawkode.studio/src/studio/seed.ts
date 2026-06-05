import { buildLowerThirdHtml } from "../lowerThird";
import type { CanvasResolution, StudioSource, StudioState } from "../types";
import { compileScenes, defineScene, layouts, people } from "./scenes/sceneDsl";

export function createInitialStudioState(): StudioState {
  const resolution: CanvasResolution = {
    width: 1920,
    height: 1080,
    fps: 30,
  };
  const lowerThirdHtml = buildLowerThirdHtml("Rawkode Live", "Composable cloud native systems");
  const sources = createInitialSources();
  const document = compileScenes({
    definitions: [
      defineScene({
        id: "intro",
        name: "Intro",
        transition: "fade",
        layout: layouts.fullscreenVideo("source-intro-video", {
          color: "#39d5c5",
          label: "Rawkode Live",
        }),
      }),
      defineScene({
        id: "monologue",
        name: "Monologue",
        transition: "cut",
        layout: layouts.solo(people.selector("hosts"), {
          lowerThird: true,
        }),
      }),
      defineScene({
        id: "guests",
        name: "Guests",
        transition: "cut",
        layout: layouts.dynamicGrid(
          [people.selector("hosts"), people.selector("guests"), people.selector("producer")],
          {
            lowerThird: true,
          },
        ),
      }),
      defineScene({
        id: "screenshare",
        name: "Screenshare",
        transition: "cut",
        layout: layouts.screenshare(
          "source-screen-share",
          [people.selector("hosts"), people.selector("guests"), people.selector("producer")],
          {
            lowerThird: {
              enabled: false,
            },
          },
        ),
      }),
      defineScene({
        id: "outro",
        name: "Outro",
        transition: "fade",
        layout: layouts.fullscreenVideo("source-outro-video", {
          color: "#ff9167",
          label: "Thanks for watching",
        }),
      }),
    ],
    lowerThirdHtml,
    resolution,
    sources,
  });

  return {
    resolution,
    phase: "designing",
    sources,
    scenes: document.scenes,
    layers: document.layers,
    previewSceneId: "intro",
    programSceneId: "intro",
    selectedLayerId: "intro-video",
    htmlDraft: "",
    lowerThird: {
      speaker: "Rawkode Live",
      comment: "Composable cloud native systems",
    },
    isPlaying: true,
    isRecording: false,
    status: "Intro on program",
  };
}

function createInitialSources(): StudioSource[] {
  return [
    {
      id: "source-intro-video",
      name: "Intro Video",
      type: "video",
      status: "ready",
    },
    {
      id: "source-outro-video",
      name: "Outro Video",
      type: "video",
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
      id: "source-screen-share",
      name: "Screen Share",
      type: "screen",
      status: "ready",
    },
    {
      id: "source-lower-third",
      name: "Lower Third Comment",
      type: "comment",
      status: "ready",
    },
  ];
}

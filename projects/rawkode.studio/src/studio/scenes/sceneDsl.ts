import { buildLowerThirdHtml } from "../../lowerThird";
import type {
  Bounds,
  CanvasResolution,
  OverlayLifecycle,
  OverlayRole,
  OverlayTransitionEffect,
  PeopleRole,
  RemotionCompositionId,
  SceneAction,
  SceneLayout,
  SceneSwitchEffect,
  SceneTransition,
  StudioLayer,
  StudioScene,
  StudioSource,
  TransitionAxis,
  TransitionDirection,
} from "../../types";
import { getDynamicGridBounds, getScreenshareCameraBounds, scaleBounds } from "../layouts";

export interface PeopleSelector {
  kind: "people-selector";
  role: PeopleRole;
}

type LowerThirdInput = boolean | LowerThirdOptions;
type MediaActionsInput = SceneAction | SceneAction[] | undefined;

export type SceneLayoutDefinition =
  | { kind: "dynamic-grid"; selectors: PeopleSelector[]; lowerThird?: LowerThirdInput }
  | {
      kind: "remotion";
      compositionId: RemotionCompositionId;
      subtitle?: string;
      title: string;
      lowerThird?: LowerThirdInput;
      onEnd?: SceneAction[];
    }
  | { kind: "screenshare"; screenSourceId: string; selectors: PeopleSelector[]; lowerThird?: LowerThirdInput }
  | { kind: "solo"; selector: PeopleSelector; lowerThird?: LowerThirdInput };

export interface LowerThirdOptions extends OverlayLifecycle {
  enabled?: boolean;
}

interface NormalizedLowerThirdOptions {
  enabled: boolean;
  overlay: OverlayLifecycle;
}

export interface SceneMediaDefinition {
  id: string;
  name: string;
  type: "audio" | "video";
  sourceId: string;
  enabled?: boolean;
  onEnd?: SceneAction[];
}

export interface SceneDefinition {
  id: string;
  name: string;
  layout: SceneLayoutDefinition;
  media?: SceneMediaDefinition[];
  stinger?: SceneSwitchEffect;
  transition: SceneTransition;
}

export interface CompileScenesOptions {
  definitions: SceneDefinition[];
  lowerThirdHtml?: string;
  resolution: CanvasResolution;
  sources: StudioSource[];
}

export const people = {
  selector(role: PeopleRole): PeopleSelector {
    return {
      kind: "people-selector",
      role,
    };
  },
};

export const actions = {
  changeScene(sceneId: string): SceneAction {
    return {
      type: "changeScene",
      sceneId,
    };
  },

  runHook(hookId: string): SceneAction {
    return {
      type: "runHook",
      hookId,
    };
  },
};

export const transitions = {
  cut(durationSeconds = 0): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "cut",
      durationSeconds,
    };
  },

  fade(durationSeconds = 0.18): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "fade",
      durationSeconds,
    };
  },

  slide(direction: TransitionDirection = "up", durationSeconds = 0.24): OverlayTransitionEffect {
    return createDirectedTransition("slide", direction, durationSeconds);
  },

  flip(axis: TransitionAxis = "x", durationSeconds = 0.32): OverlayTransitionEffect {
    return {
      axis,
      kind: "motion-transition",
      transition: "flip",
      durationSeconds,
    };
  },

  typewriter(durationSeconds = 0.72): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "typewriter",
      durationSeconds,
    };
  },

  cubeSpin(direction: TransitionDirection = "right", durationSeconds = 0.42): OverlayTransitionEffect {
    return createDirectedTransition("cube-spin", direction, durationSeconds);
  },

  wipe(direction: TransitionDirection = "right", durationSeconds = 0.28): OverlayTransitionEffect {
    return createDirectedTransition("wipe", direction, durationSeconds);
  },

  scale(durationSeconds = 0.22): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "scale",
      durationSeconds,
    };
  },

  blur(durationSeconds = 0.26): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "blur",
      durationSeconds,
    };
  },

  glitch(durationSeconds = 0.3): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "glitch",
      durationSeconds,
    };
  },

  pop(durationSeconds = 0.18): OverlayTransitionEffect {
    return {
      kind: "motion-transition",
      transition: "pop",
      durationSeconds,
    };
  },
};

export const overlays = {
  banner(options: OverlayLifecycle = {}): OverlayLifecycle {
    return options;
  },

  comment(options: OverlayLifecycle = {}): OverlayLifecycle {
    return options;
  },

  lowerThird(options: LowerThirdOptions = {}): LowerThirdOptions {
    return options;
  },

  ticker(options: OverlayLifecycle = {}): OverlayLifecycle {
    return options;
  },
};

export const layouts = {
  dynamicGrid(selectors: PeopleSelector[], options: { lowerThird?: LowerThirdInput } = {}): SceneLayoutDefinition {
    return {
      kind: "dynamic-grid",
      lowerThird: options.lowerThird,
      selectors,
    };
  },

  remotion(
    compositionId: RemotionCompositionId,
    options: { lowerThird?: LowerThirdInput; onEnd?: MediaActionsInput; subtitle?: string; title: string },
  ): SceneLayoutDefinition {
    return {
      kind: "remotion",
      onEnd: normalizeActions(options.onEnd),
      compositionId,
      subtitle: options.subtitle,
      title: options.title,
      lowerThird: options.lowerThird,
    };
  },

  screenshare(
    screenSourceId: string,
    selectors: PeopleSelector[],
    options: { lowerThird?: LowerThirdInput } = {},
  ): SceneLayoutDefinition {
    return {
      kind: "screenshare",
      lowerThird: options.lowerThird,
      screenSourceId,
      selectors,
    };
  },

  solo(selector: PeopleSelector, options: { lowerThird?: LowerThirdInput } = {}): SceneLayoutDefinition {
    return {
      kind: "solo",
      lowerThird: options.lowerThird,
      selector,
    };
  },
};

export const media = {
  audio(
    id: string,
    sourceId: string,
    options: { enabled?: boolean; name?: string; onEnd?: MediaActionsInput } = {},
  ): SceneMediaDefinition {
    return {
      id,
      name: options.name ?? "Audio",
      type: "audio",
      sourceId,
      enabled: options.enabled,
      onEnd: normalizeActions(options.onEnd),
    };
  },

  video(
    id: string,
    sourceId: string,
    options: { enabled?: boolean; name?: string; onEnd?: MediaActionsInput } = {},
  ): SceneMediaDefinition {
    return {
      id,
      name: options.name ?? "Video",
      type: "video",
      sourceId,
      enabled: options.enabled,
      onEnd: normalizeActions(options.onEnd),
    };
  },
};

export function defineScene(definition: SceneDefinition): SceneDefinition {
  return definition;
}

export function compileScenes(options: CompileScenesOptions): { layers: StudioLayer[]; scenes: StudioScene[] } {
  const layers: StudioLayer[] = [];
  const scenes = options.definitions.map((definition) => {
    const compiled = compileScene(definition, options);
    layers.push(...compiled.layers);
    return compiled.scene;
  });

  return {
    layers,
    scenes,
  };
}

function compileScene(
  definition: SceneDefinition,
  options: CompileScenesOptions,
): { layers: StudioLayer[]; scene: StudioScene } {
  const lowerThirdHtml = options.lowerThirdHtml ?? buildLowerThirdHtml("Rawkode Live", "Composable cloud native systems");
  const layers = [
    ...compileSceneLayers(definition, options.sources, options.resolution, lowerThirdHtml),
    ...compileSceneMediaLayers(definition),
  ];

  return {
    layers,
    scene: {
      id: definition.id,
      layerIds: layers.map((layer) => layer.id),
      layout: getSceneLayout(definition.layout),
      name: definition.name,
      stinger: definition.stinger,
      transition: definition.transition,
    },
  };
}

function compileSceneLayers(
  definition: SceneDefinition,
  sources: StudioSource[],
  resolution: CanvasResolution,
  lowerThirdHtml: string,
): StudioLayer[] {
  switch (definition.layout.kind) {
    case "dynamic-grid":
      return [
        createStageLayer(definition.id, resolution),
        ...createCameraLayers(
          definition.id,
          resolvePeopleSources(sources, definition.layout.selectors),
          getDynamicGridBounds,
          resolution,
        ),
        createLowerThirdLayer(definition.id, lowerThirdHtml, definition.layout.lowerThird, resolution),
      ];

    case "remotion":
      return [
        {
          id: `${definition.id}-remotion`,
          name: definition.name,
          type: "remotion",
          sourceId: `source-${definition.layout.compositionId}`,
          enabled: true,
          locked: true,
          opacity: 1,
          bounds: scaleBounds([{ x: 0, y: 0, width: 1920, height: 1080 }], resolution)[0],
          settings: createRemotionSettings(definition.layout),
        },
        createLowerThirdLayer(
          definition.id,
          lowerThirdHtml,
          definition.layout.lowerThird ?? { enabled: false },
          resolution,
        ),
      ];

    case "screenshare":
      return [
        createStageLayer(definition.id, resolution),
        {
          id: `${definition.id}-screen`,
          name: "Screen Share",
          type: "screen",
          sourceId: definition.layout.screenSourceId,
          enabled: true,
          opacity: 1,
          label: "Screen Share",
          bounds: scaleBounds([{ x: 88, y: 96, width: 1744, height: 828 }], resolution)[0],
        },
        ...createCameraLayers(
          definition.id,
          resolvePeopleSources(sources, definition.layout.selectors),
          getScreenshareCameraBounds,
          resolution,
        ),
        createLowerThirdLayer(definition.id, lowerThirdHtml, definition.layout.lowerThird, resolution),
      ];

    case "solo": {
      const [source] = resolvePeopleSources(sources, [definition.layout.selector]);
      return [
        createStageLayer(definition.id, resolution),
        ...(source
          ? [
              createCameraLayer(definition.id, source, scaleBounds([{ x: 206, y: 116, width: 1508, height: 802 }], resolution)[0]),
            ]
          : []),
        createLowerThirdLayer(definition.id, lowerThirdHtml, definition.layout.lowerThird, resolution),
      ];
    }
  }
}

function compileSceneMediaLayers(definition: SceneDefinition): StudioLayer[] {
  return (definition.media ?? []).map((layer) => ({
    id: `${definition.id}-${layer.id}`,
    name: layer.name,
    type: layer.type,
    sourceId: layer.sourceId,
    enabled: layer.enabled ?? true,
    locked: true,
    opacity: 1,
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    settings: createMediaSettings(layer.onEnd),
  }));
}

function createStageLayer(sceneId: string, resolution: CanvasResolution): StudioLayer {
  return {
    id: `${sceneId}-stage-light`,
    name: "Stage Wash",
    type: "background",
    sourceId: "source-stage-wash",
    enabled: true,
    locked: true,
    opacity: 1,
    bounds: scaleBounds([{ x: 0, y: 0, width: 1920, height: 1080 }], resolution)[0],
  };
}

function createCameraLayers(
  sceneId: string,
  sources: StudioSource[],
  getBounds: (count: number, resolution: CanvasResolution) => Bounds[],
  resolution: CanvasResolution,
): StudioLayer[] {
  const enabledSources = sources.filter((source) => source.status === "ready");
  const enabledBounds = getBounds(enabledSources.length, resolution);
  const boundsBySourceId = new Map(enabledSources.map((source, index) => [source.id, enabledBounds[index]]));

  return sources.map((source) =>
    createCameraLayer(
      sceneId,
      source,
      boundsBySourceId.get(source.id) ?? scaleBounds([{ x: 1288, y: 192, width: 520, height: 560 }], resolution)[0],
    ),
  );
}

function createCameraLayer(sceneId: string, source: StudioSource, bounds: Bounds): StudioLayer {
  return {
    id: `${sceneId}-${source.id.replace(/^source-/, "")}`,
    name: source.name,
    type: "camera",
    sourceId: source.id,
    enabled: source.status === "ready",
    opacity: 1,
    color: source.color,
    label: source.label ?? source.name,
    bounds,
  };
}

function createLowerThirdLayer(
  sceneId: string,
  html: string,
  input: LowerThirdInput | undefined,
  resolution: CanvasResolution,
): StudioLayer {
  const options = normalizeLowerThirdOptions(input);

  return {
    id: `${sceneId}-lower-third`,
    name: "Lower Third",
    type: "html",
    sourceId: "source-lower-third",
    enabled: options.enabled,
    opacity: 1,
    bounds: scaleBounds([{ x: 144, y: 812, width: 780, height: 150 }], resolution)[0],
    html,
    settings: createOverlaySettings("lower-third", options.overlay),
  };
}

function normalizeLowerThirdOptions(input: LowerThirdInput | undefined): NormalizedLowerThirdOptions {
  if (typeof input === "boolean") {
    return {
      enabled: input,
      overlay: getDefaultOverlayLifecycle(),
    };
  }

  return {
    enabled: input?.enabled ?? true,
    overlay: input ? getOverlayLifecycle(input) : getDefaultOverlayLifecycle(),
  };
}

function normalizeActions(input: MediaActionsInput): SceneAction[] | undefined {
  if (!input) {
    return undefined;
  }

  return Array.isArray(input) ? input : [input];
}

function createMediaSettings(onEnd: SceneAction[] | undefined): StudioLayer["settings"] | undefined {
  return onEnd?.length
    ? {
        media: {
          onEnd,
        },
      }
    : undefined;
}

function createRemotionSettings(
  layout: Extract<SceneLayoutDefinition, { kind: "remotion" }>,
): StudioLayer["settings"] {
  return {
    ...createMediaSettings(layout.onEnd),
    remotion: {
      compositionId: layout.compositionId,
      subtitle: layout.subtitle,
      title: layout.title,
    },
  };
}

function createOverlaySettings(role: OverlayRole, lifecycle: OverlayLifecycle): StudioLayer["settings"] {
  return {
    overlay: {
      role,
      lifecycle,
    },
  };
}

function createDirectedTransition(
  transition: SceneTransition,
  direction: TransitionDirection,
  durationSeconds: number,
): OverlayTransitionEffect {
  return {
    direction,
    kind: "motion-transition",
    transition,
    durationSeconds,
  };
}

function getDefaultOverlayLifecycle(): OverlayLifecycle {
  return {
    enter: transitions.fade(0.18),
    visibleSeconds: 8,
    exit: transitions.fade(0.16),
  };
}

function getOverlayLifecycle(options: LowerThirdOptions): OverlayLifecycle {
  const defaults = getDefaultOverlayLifecycle();

  return {
    enter: options.enter ?? defaults.enter,
    visibleSeconds: options.visibleSeconds ?? defaults.visibleSeconds,
    exit: options.exit ?? defaults.exit,
  };
}

function resolvePeopleSources(sources: StudioSource[], selectors: PeopleSelector[]): StudioSource[] {
  const sourceIds = new Set<string>();
  const selected: StudioSource[] = [];

  for (const selector of selectors) {
    for (const source of sources) {
      if (source.type !== "camera" || !source.roles?.includes(selector.role) || sourceIds.has(source.id)) {
        continue;
      }

      sourceIds.add(source.id);
      selected.push(source);
    }
  }

  return selected;
}

function getSceneLayout(layout: SceneLayoutDefinition): SceneLayout {
  if (layout.kind === "dynamic-grid") {
    return "dynamic-grid";
  }

  if (layout.kind === "remotion") {
    return "remotion";
  }

  if (layout.kind === "screenshare") {
    return "screenshare";
  }

  return "solo";
}

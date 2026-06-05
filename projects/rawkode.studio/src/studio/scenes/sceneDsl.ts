import { buildLowerThirdHtml } from "../../lowerThird";
import type {
  Bounds,
  CanvasResolution,
  PeopleRole,
  SceneLayout,
  SceneTransition,
  StudioLayer,
  StudioScene,
  StudioSource,
} from "../../types";
import { getDynamicGridBounds, getScreenshareCameraBounds, scaleBounds } from "../layouts";

export interface PeopleSelector {
  kind: "people-selector";
  role: PeopleRole;
}

type LowerThirdInput = boolean | LowerThirdOptions;

export type SceneLayoutDefinition =
  | { kind: "dynamic-grid"; selectors: PeopleSelector[]; lowerThird?: LowerThirdInput }
  | { kind: "fullscreen-video"; sourceId: string; color?: string; label?: string }
  | { kind: "screenshare"; screenSourceId: string; selectors: PeopleSelector[]; lowerThird?: LowerThirdInput }
  | { kind: "solo"; selector: PeopleSelector; lowerThird?: LowerThirdInput };

export interface LowerThirdOptions {
  enabled?: boolean;
}

export interface SceneDefinition {
  id: string;
  name: string;
  layout: SceneLayoutDefinition;
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

export const layouts = {
  dynamicGrid(selectors: PeopleSelector[], options: { lowerThird?: LowerThirdInput } = {}): SceneLayoutDefinition {
    return {
      kind: "dynamic-grid",
      lowerThird: options.lowerThird,
      selectors,
    };
  },

  fullscreenVideo(sourceId: string, options: { color?: string; label?: string } = {}): SceneLayoutDefinition {
    return {
      kind: "fullscreen-video",
      sourceId,
      ...options,
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
  const layers = compileSceneLayers(definition, options.sources, options.resolution, lowerThirdHtml);

  return {
    layers,
    scene: {
      id: definition.id,
      layerIds: layers.map((layer) => layer.id),
      layout: getSceneLayout(definition.layout),
      name: definition.name,
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
          10,
        ),
        createLowerThirdLayer(definition.id, lowerThirdHtml, definition.layout.lowerThird, resolution, 100),
      ];

    case "fullscreen-video":
      return [
        {
          id: `${definition.id}-video`,
          name: definition.name === "Intro" ? "Intro Video" : "Outro Video",
          type: "video",
          sourceId: definition.layout.sourceId,
          enabled: true,
          locked: true,
          opacity: 1,
          zIndex: 10,
          color: definition.layout.color,
          label: definition.layout.label,
          bounds: scaleBounds([{ x: 0, y: 0, width: 1920, height: 1080 }], resolution)[0],
        },
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
          zIndex: 10,
          label: "Screen Share",
          bounds: scaleBounds([{ x: 88, y: 96, width: 1744, height: 828 }], resolution)[0],
        },
        ...createCameraLayers(
          definition.id,
          resolvePeopleSources(sources, definition.layout.selectors),
          getScreenshareCameraBounds,
          resolution,
          20,
        ),
        createLowerThirdLayer(definition.id, lowerThirdHtml, definition.layout.lowerThird, resolution, 100),
      ];

    case "solo": {
      const [source] = resolvePeopleSources(sources, [definition.layout.selector]);
      return [
        createStageLayer(definition.id, resolution),
        ...(source
          ? [
              createCameraLayer(definition.id, source, scaleBounds([{ x: 206, y: 116, width: 1508, height: 802 }], resolution)[0], 10),
            ]
          : []),
        createLowerThirdLayer(definition.id, lowerThirdHtml, definition.layout.lowerThird, resolution, 100),
      ];
    }
  }
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
    zIndex: 0,
    bounds: scaleBounds([{ x: 0, y: 0, width: 1920, height: 1080 }], resolution)[0],
  };
}

function createCameraLayers(
  sceneId: string,
  sources: StudioSource[],
  getBounds: (count: number, resolution: CanvasResolution) => Bounds[],
  resolution: CanvasResolution,
  baseZIndex: number,
): StudioLayer[] {
  const enabledSources = sources.filter((source) => source.status === "ready");
  const enabledBounds = getBounds(enabledSources.length, resolution);
  const boundsBySourceId = new Map(enabledSources.map((source, index) => [source.id, enabledBounds[index]]));

  return sources.map((source, index) =>
    createCameraLayer(
      sceneId,
      source,
      boundsBySourceId.get(source.id) ?? scaleBounds([{ x: 1288, y: 192, width: 520, height: 560 }], resolution)[0],
      baseZIndex + index * 10,
    ),
  );
}

function createCameraLayer(sceneId: string, source: StudioSource, bounds: Bounds, zIndex: number): StudioLayer {
  return {
    id: `${sceneId}-${source.id.replace(/^source-/, "")}`,
    name: source.name,
    type: "camera",
    sourceId: source.id,
    enabled: source.status === "ready",
    opacity: 1,
    zIndex,
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
  zIndex: number,
): StudioLayer {
  const options = normalizeLowerThirdOptions(input);

  return {
    id: `${sceneId}-lower-third`,
    name: "Lower Third",
    type: "html",
    sourceId: "source-lower-third",
    enabled: options.enabled,
    opacity: 1,
    zIndex,
    bounds: scaleBounds([{ x: 144, y: 812, width: 780, height: 150 }], resolution)[0],
    html,
  };
}

function normalizeLowerThirdOptions(input: LowerThirdInput | undefined): Required<LowerThirdOptions> {
  if (typeof input === "boolean") {
    return {
      enabled: input,
    };
  }

  return {
    enabled: input?.enabled ?? true,
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

  if (layout.kind === "fullscreen-video") {
    return "fullscreen-video";
  }

  if (layout.kind === "screenshare") {
    return "screenshare";
  }

  return "solo";
}

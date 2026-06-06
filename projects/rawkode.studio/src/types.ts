export type LayerType = "audio" | "background" | "camera" | "html" | "remotion" | "screen" | "video";
export type PeopleRole = "guests" | "hosts" | "producer";
export type SourceType = "audio" | "camera" | "comment" | "graphic" | "html" | "remotion" | "screen" | "video" | "browser";
export type StudioPhase = "designing" | "previewing" | "live" | "recording";
export type SceneLayout = "dynamic-grid" | "freeform" | "remotion" | "screenshare" | "solo";
export type TransitionAxis = "x" | "y";
export type TransitionDirection = "down" | "left" | "right" | "up";
export type SceneTransition =
  | "blur"
  | "cube-spin"
  | "cut"
  | "fade"
  | "flip"
  | "glitch"
  | "pop"
  | "scale"
  | "slide"
  | "typewriter"
  | "wipe";

export type SceneAction =
  | { type: "changeScene"; sceneId: string }
  | { type: "runHook"; hookId: string };

export type SceneSwitchEffect = {
  kind: "motion-transition";
  transition: SceneTransition;
  axis?: TransitionAxis;
  direction?: TransitionDirection;
  durationSeconds?: number;
};

export type OverlayRole = "banner" | "comment" | "lower-third" | "ticker";

export interface OverlayTransitionEffect {
  kind: "motion-transition";
  transition: SceneTransition;
  axis?: TransitionAxis;
  direction?: TransitionDirection;
  durationSeconds?: number;
}

export type RemotionCompositionId = "rawkode-intro" | "rawkode-outro";

export interface OverlayLifecycle {
  enter?: OverlayTransitionEffect;
  exit?: OverlayTransitionEffect;
  visibleSeconds?: number;
}

export interface LayerSettings {
  media?: {
    onEnd?: SceneAction[];
  };
  overlay?: {
    role: OverlayRole;
    lifecycle: OverlayLifecycle;
  };
  remotion?: {
    compositionId: RemotionCompositionId;
    title: string;
    subtitle?: string;
  };
  [key: string]: unknown;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioSource {
  id: string;
  name: string;
  type: SourceType;
  status: "ready" | "muted" | "missing" | "loading";
  color?: string;
  label?: string;
  roles?: PeopleRole[];
  settings?: Record<string, unknown>;
}

export interface StudioLayer {
  id: string;
  name: string;
  type: LayerType;
  sourceId?: string;
  enabled: boolean;
  locked?: boolean;
  opacity: number;
  bounds: Bounds;
  color?: string;
  label?: string;
  html?: string;
  settings?: LayerSettings;
}

export interface ScenePreset {
  id: string;
  name: string;
  layerIds: string[];
  layout?: SceneLayout;
  stinger?: SceneSwitchEffect;
  transition?: SceneTransition;
}

export type StudioScene = ScenePreset;

export interface CanvasResolution {
  width: number;
  height: number;
  fps: number;
}

export interface LowerThirdDraft {
  speaker: string;
  comment: string;
}

export interface ActiveSceneStinger {
  effect: SceneSwitchEffect;
  fromSceneId: string;
  toSceneId: string;
}

export interface ActiveOverlay {
  layerId: string;
  lifecycle: OverlayLifecycle;
  phase: "entering" | "visible" | "exiting";
}

export interface StudioState {
  resolution: CanvasResolution;
  activeScreenShareSourceId: string;
  phase: StudioPhase;
  sources: StudioSource[];
  scenes: StudioScene[];
  layers: StudioLayer[];
  previewSceneId: string;
  programSceneId: string;
  selectedLayerId: string;
  htmlDraft: string;
  lowerThird: LowerThirdDraft;
  activeOverlays: Record<string, ActiveOverlay>;
  activeStinger?: ActiveSceneStinger;
  lastHookId?: string;
  isPlaying: boolean;
  isRecording: boolean;
  status: string;
}

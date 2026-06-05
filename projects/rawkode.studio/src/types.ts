export type LayerType = "background" | "camera" | "html" | "screen" | "video";
export type PeopleRole = "guests" | "hosts" | "producer";
export type SourceType = "camera" | "comment" | "graphic" | "html" | "screen" | "video" | "browser";
export type StudioPhase = "designing" | "previewing" | "live" | "recording";
export type SceneLayout = "dynamic-grid" | "freeform" | "fullscreen-video" | "screenshare" | "solo";
export type SceneTransition = "cut" | "fade";

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
  zIndex?: number;
  bounds: Bounds;
  color?: string;
  label?: string;
  html?: string;
  settings?: Record<string, unknown>;
}

export interface ScenePreset {
  id: string;
  name: string;
  layerIds: string[];
  layout?: SceneLayout;
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

export interface StudioState {
  resolution: CanvasResolution;
  phase: StudioPhase;
  sources: StudioSource[];
  scenes: StudioScene[];
  layers: StudioLayer[];
  previewSceneId: string;
  programSceneId: string;
  selectedLayerId: string;
  htmlDraft: string;
  lowerThird: LowerThirdDraft;
  isPlaying: boolean;
  isRecording: boolean;
  status: string;
}

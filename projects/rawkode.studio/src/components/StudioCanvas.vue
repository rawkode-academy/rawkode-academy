<script setup lang="ts">
import { animate } from "motion";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderProgramCanvas } from "../canvas/programRenderer";
import { useCanvasRenderLoop } from "../canvas/useCanvasRenderLoop";
import { getHitTestLayerStack } from "../studio/layerStack";
import type { ActiveOverlay, ActiveSceneStinger, CanvasResolution, StudioLayer } from "../types";

type MotionAnimationControls = ReturnType<typeof animate>;

const props = defineProps<{
  activeOverlays?: Record<string, ActiveOverlay>;
  activeStinger?: ActiveSceneStinger;
  layers: StudioLayer[];
  mediaStreams?: Map<string, MediaStream>;
  resolution: CanvasResolution;
  isPlaying: boolean;
  isRecording: boolean;
  title: string;
  subtitle?: string;
  interactive?: boolean;
}>();

const emit = defineEmits<{
  exported: [];
  "recording-change": [recording: boolean];
  "select-layer": [id: string];
  "update-layer-bounds": [id: string, bounds: StudioLayer["bounds"]];
}>();

const canvasElement = ref<HTMLCanvasElement | null>(null);
const frameElement = ref<HTMLElement | null>(null);
const canvasDisplaySize = ref({ width: 0, height: 0 });
const canRecordLocally = typeof MediaRecorder !== "undefined";
const isDragging = ref(false);
const isLocalRecording = ref(false);
const overlayPhaseStarts = new Map<string, { phase: ActiveOverlay["phase"]; startedAt: number }>();
const overlayTransitionProgresses = new Map<string, number>();
const overlayAnimations = new Map<string, MotionAnimationControls>();
let bufferCanvas: HTMLCanvasElement | undefined;
let frameResizeObserver: ResizeObserver | undefined;
let mediaRecorder: MediaRecorder | undefined;
let recordedChunks: BlobPart[] = [];
let recordingOwnedTracks: MediaStreamTrack[] = [];
const mediaVideoElements = new Map<string, HTMLVideoElement>();
let stingerAnimation: MotionAnimationControls | undefined;
let stingerProgress: number | undefined;
let stingerStartedAt: number | undefined;
let dragState:
  | {
      layerId: string;
      pointerId: number;
      offsetX: number;
      offsetY: number;
    }
  | undefined;
const renderLoop = useCanvasRenderLoop(paint, () => props.isPlaying);
const canvasStyle = computed(() => ({
  width: canvasDisplaySize.value.width > 0 ? `${canvasDisplaySize.value.width}px` : "100%",
  height: canvasDisplaySize.value.height > 0 ? `${canvasDisplaySize.value.height}px` : "auto",
  aspectRatio: `${props.resolution.width} / ${props.resolution.height}`,
}));

async function paint(timestamp = performance.now()): Promise<void> {
  const canvas = canvasElement.value;
  if (!canvas) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const backingWidth = props.resolution.width * ratio;
  const backingHeight = props.resolution.height * ratio;

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const buffer = getBufferCanvas(backingWidth, backingHeight);
  const bufferContext = buffer.getContext("2d");
  if (!bufferContext) {
    return;
  }

  bufferContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  await renderProgramCanvas(bufferContext, {
    activeOverlays: props.activeOverlays,
    activeStinger: props.activeStinger,
    layers: props.layers,
    mediaVideoElements: getMediaVideoElements(),
    overlayTransitionProgresses: getOverlayTransitionProgresses(),
    overlayTransitionStarts: getOverlayTransitionStarts(),
    resolution: props.resolution,
    isRecording: props.isRecording,
    stingerProgress,
    stingerStartedAt,
    timestamp,
  });
  bufferContext.setTransform(1, 0, 0, 1, 0, 0);

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, backingWidth, backingHeight);
  context.drawImage(buffer, 0, 0);
}

function getBufferCanvas(width: number, height: number): HTMLCanvasElement {
  if (!bufferCanvas) {
    bufferCanvas = document.createElement("canvas");
  }

  if (bufferCanvas.width !== width || bufferCanvas.height !== height) {
    bufferCanvas.width = width;
    bufferCanvas.height = height;
  }

  return bufferCanvas;
}

function exportPng(): void {
  const canvas = canvasElement.value;
  if (!canvas) {
    return;
  }

  const link = document.createElement("a");
  link.download = "rawkode-studio-program.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  emit("exported");
}

function captureCanvasStream(): MediaStream | undefined {
  return canvasElement.value?.captureStream(props.resolution.fps);
}

function toggleLocalRecording(): void {
  if (isLocalRecording.value) {
    stopLocalRecording();
    return;
  }

  startLocalRecording();
}

function startLocalRecording(): void {
  if (typeof MediaRecorder === "undefined") {
    return;
  }

  const recordingStream = createRecordingStream();
  if (!recordingStream) {
    return;
  }

  const mimeType = getSupportedRecordingMimeType();
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  });
  mediaRecorder.addEventListener("stop", downloadRecording);
  mediaRecorder.start();
  isLocalRecording.value = true;
  emit("recording-change", true);
}

function stopLocalRecording(): void {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    finishLocalRecording();
    return;
  }

  mediaRecorder.stop();
}

function downloadRecording(): void {
  const mimeType = mediaRecorder?.mimeType || "video/webm";
  const blob = new Blob(recordedChunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = `rawkode-studio-program-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  finishLocalRecording();
}

function finishLocalRecording(): void {
  for (const track of recordingOwnedTracks) {
    track.stop();
  }
  recordingOwnedTracks = [];
  mediaRecorder = undefined;
  recordedChunks = [];
  isLocalRecording.value = false;
  emit("recording-change", false);
}

function createRecordingStream(): MediaStream | undefined {
  const canvasStream = captureCanvasStream();
  if (!canvasStream) {
    return undefined;
  }

  const audioTracks = [...(props.mediaStreams?.values() ?? [])]
    .flatMap((stream) => stream.getAudioTracks())
    .filter((track) => track.readyState === "live")
    .map((track) => track.clone());
  recordingOwnedTracks = [...canvasStream.getTracks(), ...audioTracks];

  return new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
}

function getSupportedRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return "";
  }

  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  ) ?? "";
}

function onPointerDown(event: PointerEvent): void {
  if (!props.interactive) {
    return;
  }

  const canvasPoint = getCanvasPoint(event);
  const layer = canvasPoint ? getLayerAtPoint(canvasPoint.x, canvasPoint.y) : undefined;
  if (!canvasPoint || !layer) {
    return;
  }

  event.preventDefault();
  canvasElement.value?.setPointerCapture(event.pointerId);
  emit("select-layer", layer.id);
  isDragging.value = true;
  dragState = {
    layerId: layer.id,
    pointerId: event.pointerId,
    offsetX: canvasPoint.x - layer.bounds.x,
    offsetY: canvasPoint.y - layer.bounds.y,
  };
}

function onPointerMove(event: PointerEvent): void {
  if (!props.interactive) {
    return;
  }

  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  const canvasPoint = getCanvasPoint(event);
  const layer = props.layers.find((candidate) => candidate.id === dragState?.layerId);
  if (!canvasPoint || !layer) {
    return;
  }

  event.preventDefault();
  const x = clamp(
    Math.round(canvasPoint.x - dragState.offsetX),
    0,
    Math.max(0, props.resolution.width - layer.bounds.width),
  );
  const y = clamp(
    Math.round(canvasPoint.y - dragState.offsetY),
    0,
    Math.max(0, props.resolution.height - layer.bounds.height),
  );

  emit("update-layer-bounds", layer.id, {
    ...layer.bounds,
    x,
    y,
  });
  renderLoop.queuePaint();
}

function onPointerUp(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  canvasElement.value?.releasePointerCapture(event.pointerId);
  dragState = undefined;
  isDragging.value = false;
}

function getCanvasPoint(event: PointerEvent): { x: number; y: number } | undefined {
  const canvas = canvasElement.value;
  if (!canvas) {
    return undefined;
  }

  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * props.resolution.width,
    y: ((event.clientY - rect.top) / rect.height) * props.resolution.height,
  };
}

function getLayerAtPoint(x: number, y: number): StudioLayer | undefined {
  return getHitTestLayerStack(props.layers).find((layer) => isInsideBounds(x, y, layer));
}

function isInsideBounds(x: number, y: number, layer: StudioLayer): boolean {
  return (
    x >= layer.bounds.x &&
    x <= layer.bounds.x + layer.bounds.width &&
    y >= layer.bounds.y &&
    y <= layer.bounds.y + layer.bounds.height
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

watch(
  () => props.isPlaying,
  () => {
    renderLoop.queuePaint();
  },
  { immediate: true },
);

watch(
  () => [props.layers, props.isRecording, props.resolution],
  () => {
    updateCanvasDisplaySize();
    if (!props.isPlaying) {
      renderLoop.queuePaint();
    }
  },
  { deep: true },
);

watch(
  () => props.activeOverlays ?? {},
  (activeOverlays) => {
    syncOverlayPhaseStarts(activeOverlays);
    renderLoop.queuePaint();
  },
  { deep: true, immediate: true },
);

watch(
  () => props.mediaStreams,
  (streams) => {
    syncMediaVideoElements(streams ?? new Map());
    renderLoop.queuePaint();
  },
  { immediate: true },
);

watch(
  () => getActiveStingerKey(props.activeStinger),
  (nextKey) => {
    stingerStartedAt = nextKey ? performance.now() : undefined;
    syncStingerAnimation(nextKey);
    renderLoop.queuePaint();
  },
  { immediate: true },
);

onMounted(() => {
  frameResizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) {
      return;
    }

    updateCanvasDisplaySize(entry.contentRect.width, entry.contentRect.height);
  });

  if (frameElement.value) {
    frameResizeObserver.observe(frameElement.value);
    updateCanvasDisplaySize();
  }
});

onBeforeUnmount(() => {
  if (isLocalRecording.value) {
    stopLocalRecording();
  }
  clearMediaVideoElements();
  stopOverlayAnimations();
  stopStingerAnimation();
  frameResizeObserver?.disconnect();
  renderLoop.stop();
});

defineExpose({
  captureCanvasStream,
  exportPng,
});

function syncOverlayPhaseStarts(activeOverlays: Record<string, ActiveOverlay>): void {
  const now = performance.now();

  for (const [layerId, overlay] of Object.entries(activeOverlays)) {
    const existing = overlayPhaseStarts.get(layerId);
    if (existing?.phase === overlay.phase) {
      continue;
    }

    overlayPhaseStarts.set(layerId, {
      phase: overlay.phase,
      startedAt: now,
    });
    startOverlayAnimation(layerId, overlay);
  }

  for (const layerId of [...overlayPhaseStarts.keys()]) {
    if (!activeOverlays[layerId]) {
      overlayPhaseStarts.delete(layerId);
      stopOverlayAnimation(layerId);
      overlayTransitionProgresses.delete(layerId);
    }
  }
}

function getOverlayTransitionStarts(): Map<string, number> {
  return new Map([...overlayPhaseStarts.entries()].map(([layerId, value]) => [layerId, value.startedAt]));
}

function getOverlayTransitionProgresses(): Map<string, number> {
  return new Map(overlayTransitionProgresses);
}

function getMediaVideoElements(): Map<string, HTMLVideoElement> {
  return new Map(mediaVideoElements);
}

function syncMediaVideoElements(streams: Map<string, MediaStream>): void {
  for (const [sourceId, stream] of streams) {
    const existing = mediaVideoElements.get(sourceId);
    if (existing?.srcObject === stream) {
      continue;
    }

    const video = existing ?? document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    mediaVideoElements.set(sourceId, video);
    video.play().catch(() => {
      renderLoop.queuePaint();
    });
  }

  for (const [sourceId, video] of mediaVideoElements) {
    if (streams.has(sourceId)) {
      continue;
    }

    video.pause();
    video.srcObject = null;
    mediaVideoElements.delete(sourceId);
  }
}

function clearMediaVideoElements(): void {
  for (const video of mediaVideoElements.values()) {
    video.pause();
    video.srcObject = null;
  }
  mediaVideoElements.clear();
}

function startOverlayAnimation(layerId: string, overlay: ActiveOverlay): void {
  stopOverlayAnimation(layerId);

  if (overlay.phase === "visible") {
    overlayTransitionProgresses.set(layerId, 1);
    return;
  }

  const transition = overlay.phase === "entering" ? overlay.lifecycle.enter : overlay.lifecycle.exit;
  const duration = transition?.durationSeconds ?? 0;

  if (duration <= 0) {
    overlayTransitionProgresses.set(layerId, 1);
    return;
  }

  overlayTransitionProgresses.set(layerId, 0);
  const controls = animate(0, 1, {
    duration,
    ease: "circInOut",
    onUpdate(value) {
      overlayTransitionProgresses.set(layerId, value);
      renderLoop.queuePaint();
    },
    onComplete() {
      overlayTransitionProgresses.set(layerId, 1);
      overlayAnimations.delete(layerId);
      renderLoop.queuePaint();
    },
  });
  overlayAnimations.set(layerId, controls);
}

function stopOverlayAnimation(layerId: string): void {
  overlayAnimations.get(layerId)?.stop();
  overlayAnimations.delete(layerId);
}

function stopOverlayAnimations(): void {
  for (const layerId of [...overlayAnimations.keys()]) {
    stopOverlayAnimation(layerId);
  }
}

function syncStingerAnimation(nextKey: string): void {
  stopStingerAnimation();

  if (!nextKey || !props.activeStinger) {
    stingerProgress = undefined;
    return;
  }

  stingerProgress = 0;
  stingerAnimation = animate(0, 1, {
    duration: props.activeStinger.effect.durationSeconds ?? 2,
    ease: "circInOut",
    onUpdate(value) {
      stingerProgress = value;
      renderLoop.queuePaint();
    },
    onComplete() {
      stingerProgress = 1;
      stingerAnimation = undefined;
      renderLoop.queuePaint();
    },
  });
}

function stopStingerAnimation(): void {
  stingerAnimation?.stop();
  stingerAnimation = undefined;
}

function getActiveStingerKey(stinger: ActiveSceneStinger | undefined): string {
  if (!stinger) {
    return "";
  }

  return `${stinger.fromSceneId}:${stinger.toSceneId}:${stinger.effect.transition}`;
}

function updateCanvasDisplaySize(width = frameElement.value?.clientWidth ?? 0, height = frameElement.value?.clientHeight ?? 0): void {
  if (width <= 0 || height <= 0) {
    return;
  }

  const aspectRatio = props.resolution.width / props.resolution.height;
  const widthLimitedHeight = width / aspectRatio;

  canvasDisplaySize.value =
    widthLimitedHeight <= height
      ? {
          width,
          height: widthLimitedHeight,
        }
      : {
          width: height * aspectRatio,
          height,
        };
}
</script>

<template>
  <section class="canvas-deck" :aria-label="title">
    <div class="canvas-toolbar">
      <div>
        <strong>{{ title }}</strong>
        <span>{{ subtitle ?? "HTML compositor" }}</span>
      </div>
      <div class="canvas-actions">
        <button class="secondary-button compact" type="button" @click="exportPng">
          Export PNG
        </button>
        <button
          class="record-button compact"
          :class="{ active: isLocalRecording }"
          type="button"
          :disabled="!canRecordLocally"
          @click="toggleLocalRecording"
        >
          {{ isLocalRecording ? "Stop" : "Record" }}
        </button>
        <div class="canvas-meter" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
    <div ref="frameElement" class="canvas-frame">
      <canvas
        ref="canvasElement"
        :class="{ dragging: isDragging, interactive }"
        :style="canvasStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
    </div>
  </section>
</template>

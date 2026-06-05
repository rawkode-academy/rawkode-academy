<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { renderProgramCanvas } from "../canvas/programRenderer";
import type { CanvasResolution, StudioLayer } from "../types";

const props = defineProps<{
  layers: StudioLayer[];
  resolution: CanvasResolution;
  isPlaying: boolean;
  isRecording: boolean;
  selectedLayerId?: string;
}>();

const emit = defineEmits<{
  "select-layer": [id: string];
  "update-layer-bounds": [id: string, bounds: StudioLayer["bounds"]];
}>();

const canvasElement = ref<HTMLCanvasElement | null>(null);
const isDragging = ref(false);
let frameRequest = 0;
let bufferCanvas: HTMLCanvasElement | undefined;
let paintQueued = false;
let paintInProgress = false;
let paintPending = false;
let dragState:
  | {
      layerId: string;
      pointerId: number;
      offsetX: number;
      offsetY: number;
    }
  | undefined;

function queuePaint(): void {
  if (paintQueued || paintInProgress) {
    paintPending = true;
    return;
  }

  paintQueued = true;
  frameRequest = requestAnimationFrame(async (timestamp) => {
    paintQueued = false;
    paintInProgress = true;
    await paint(timestamp);
    paintInProgress = false;

    if (paintPending || props.isPlaying) {
      paintPending = false;
      queuePaint();
    }
  });
}

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
    layers: props.layers,
    resolution: props.resolution,
    isRecording: props.isRecording,
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
}

function captureCanvasStream(): MediaStream | undefined {
  return canvasElement.value?.captureStream(props.resolution.fps);
}

function onPointerDown(event: PointerEvent): void {
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
  queuePaint();
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
  return [...props.layers]
    .filter((layer) => layer.enabled && layer.type !== "background")
    .sort((left, right) => getLayerZIndex(right) - getLayerZIndex(left))
    .find((layer) => isInsideBounds(x, y, layer));
}

function isInsideBounds(x: number, y: number, layer: StudioLayer): boolean {
  return (
    x >= layer.bounds.x &&
    x <= layer.bounds.x + layer.bounds.width &&
    y >= layer.bounds.y &&
    y <= layer.bounds.y + layer.bounds.height
  );
}

function getLayerZIndex(layer: StudioLayer): number {
  if (typeof layer.zIndex === "number") {
    return layer.zIndex;
  }

  if (layer.type === "camera") {
    return 10;
  }

  if (layer.type === "html") {
    return 30;
  }

  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

watch(
  () => props.isPlaying,
  () => {
    queuePaint();
  },
  { immediate: true },
);

watch(
  () => [props.layers, props.isRecording, props.resolution],
  () => {
    if (!props.isPlaying) {
      queuePaint();
    }
  },
  { deep: true },
);

onBeforeUnmount(() => {
  cancelAnimationFrame(frameRequest);
});

defineExpose({
  captureCanvasStream,
  exportPng,
});
</script>

<template>
  <section class="canvas-deck" aria-label="Program canvas">
    <div class="canvas-toolbar">
      <div>
        <strong>Program Canvas</strong>
        <span>HTML compositor</span>
      </div>
      <div class="canvas-meter" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
    <div class="canvas-frame">
      <canvas
        ref="canvasElement"
        :class="{ dragging: isDragging }"
        :style="{ aspectRatio: `${resolution.width} / ${resolution.height}` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
    </div>
  </section>
</template>

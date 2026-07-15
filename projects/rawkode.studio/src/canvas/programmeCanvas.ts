import type { CanvasResolution } from "../types";

type CanvasBackingStore = Pick<HTMLCanvasElement, "height" | "width">;
type CapturableCanvas = Pick<HTMLCanvasElement, "captureStream" | "height" | "width">;

export function configureProgrammeCanvasBackingStore(
  canvas: CanvasBackingStore,
  resolution: CanvasResolution,
): void {
  if (canvas.width !== resolution.width) {
    canvas.width = resolution.width;
  }
  if (canvas.height !== resolution.height) {
    canvas.height = resolution.height;
  }
}

export function captureProgrammeCanvasStream(
  canvas: CapturableCanvas,
  resolution: CanvasResolution,
): MediaStream {
  configureProgrammeCanvasBackingStore(canvas, resolution);
  return canvas.captureStream(resolution.fps);
}

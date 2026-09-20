import type { CanvasResolution } from "../types";

export type RecordingQuality = "standard" | "high";

/** Bitrate targets scale with the actual canvas; they never invent resolution. */
export function getRecordingOptions(
  resolution: CanvasResolution,
  quality: RecordingQuality,
  mimeType: string,
): MediaRecorderOptions {
  const pixelsPerSecond = resolution.width * resolution.height * resolution.fps;
  const videoBitsPerSecond = Math.round(Math.min(80_000_000, Math.max(
    2_000_000,
    pixelsPerSecond * (quality === "high" ? 0.24 : 0.12),
  )));
  return {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: quality === "high" ? 320_000 : 192_000,
    videoBitsPerSecond,
  };
}

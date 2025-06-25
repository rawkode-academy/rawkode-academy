import { z } from "astro:schema";

// ============================================
// Recording Configuration Constants
// ============================================

export const RESOLUTIONS = {
  "720": { width: 1280, height: 720, label: "720p" },
  "1080": { width: 1920, height: 1080, label: "1080p" },
  "1440": { width: 2560, height: 1440, label: "1440p" },
  "2160": { width: 3840, height: 2160, label: "2160p" },
} as const;

export const FRAMERATES = {
  "30": { value: 30, label: "30 fps" },
  "60": { value: 60, label: "60 fps" },
} as const;

export const BITRATES = {
  "3000": { value: 3000, label: "3 Mbps" },
  "4500": { value: 4500, label: "4.5 Mbps" },
  "6000": { value: 6000, label: "6 Mbps" },
  "8000": { value: 8000, label: "8 Mbps" },
  "12000": { value: 12000, label: "12 Mbps" },
  "15000": { value: 15000, label: "15 Mbps" },
} as const;

// ============================================
// Type Definitions
// ============================================

export type ResolutionKey = keyof typeof RESOLUTIONS;
export type FramerateKey = keyof typeof FRAMERATES;
export type BitrateKey = keyof typeof BITRATES;

// ============================================
// Schemas
// ============================================

// Zod schema for recording settings
export const recordingSettingsSchema = z.object({
  resolution: z.enum(["720", "1080", "1440", "2160"]),
  framerate: z.enum(["30", "60"]),
  videoBitrate: z.coerce.number().min(1000).max(20000),
});

export type RecordingSettings = z.infer<typeof recordingSettingsSchema>;

// ============================================
// Defaults
// ============================================

// Default recording settings
export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  resolution: "1080",
  framerate: "60",
  videoBitrate: 6000,
};

// ============================================
// Helper Functions
// ============================================

// Helper to get resolution dimensions
export function getResolutionDimensions(resolution: ResolutionKey) {
  return {
    width: RESOLUTIONS[resolution].width,
    height: RESOLUTIONS[resolution].height,
  };
}

// Helper to get numeric framerate value
export function getFramerateValue(framerate: FramerateKey): number {
  return FRAMERATES[framerate].value;
}

import type { ComponentType } from "react";
import type { LayoutProps } from "@/components/livestreams/room/layouts/types";

// ============================================
// Layout Registry Types and Classes
// ============================================

export interface LayoutDefinition {
  id: string;
  label: string;
  description: string;
  component: ComponentType<LayoutProps>;
  supportsScreenShare: boolean;
  maxParticipants?: number;
  minParticipants?: number;
}

class LayoutRegistry {
  private layouts: Map<string, LayoutDefinition> = new Map();

  register(layout: LayoutDefinition) {
    if (this.layouts.has(layout.id)) {
      console.warn(`Layout ${layout.id} is already registered, overwriting...`);
    }
    this.layouts.set(layout.id, layout);
  }

  get(id: string): LayoutDefinition | undefined {
    return this.layouts.get(id);
  }

  getAll(): LayoutDefinition[] {
    return Array.from(this.layouts.values());
  }

  getSelectOptions() {
    return this.getAll().map((layout) => ({
      value: layout.id,
      label: layout.label,
      description: layout.description,
    }));
  }
}

// Create singleton instance
export const layoutRegistry = new LayoutRegistry();

// ============================================
// Layout URL Helpers
// ============================================

// Helper to get LiveKit-compatible layout string
export function getLiveKitLayoutString(
  layoutId: string,
  baseUrl: string,
): string {
  // Always return the same URL with layout as a query parameter
  // Ensure baseUrl doesn't end with a slash
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  // Return the recording-templates endpoint with layout as query param
  // The EgressHelper will parse this from the URL
  return `${cleanBaseUrl}/recording-templates?layout=${layoutId}`;
}

// ============================================
// Layout Styling Utilities
// ============================================

export function getGridClass(
  participantCount: number,
  isRecording = false,
): string {
  if (participantCount === 1) {
    return "grid-cols-1";
  }
  if (participantCount === 2) {
    return isRecording ? "grid-cols-2" : "grid-cols-1 md:grid-cols-2";
  }
  if (participantCount <= 4) {
    return isRecording ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2";
  }
  if (participantCount <= 6) {
    return isRecording
      ? "grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  }
  if (participantCount <= 9) {
    return isRecording
      ? "grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
  }
  if (participantCount <= 12) {
    return isRecording
      ? "grid-cols-4"
      : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
  }
  return isRecording
    ? "grid-cols-5"
    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";
}

export const layoutStyles = {
  container:
    "w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black",
  containerWithPadding:
    "w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black p-2",
  participantTile:
    "absolute inset-0 overflow-hidden shadow-lg ring-1 ring-white/5 bg-gray-900",
  participantTileHover:
    "absolute inset-0 overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900",
};

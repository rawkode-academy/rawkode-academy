import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";

export interface LayoutProps {
  cameraTrackReferences: TrackReferenceOrPlaceholder[];
  screenShareTrack?: TrackReferenceOrPlaceholder;
  presenter?: string;
}

import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import type { LayoutProps } from "./types";

export function SingleSpeakerLayout({
  cameraTrackReferences,
  screenShareTrack,
  presenter,
}: LayoutProps) {
  // In single speaker layout, only show presenter cameras
  const presenterCameraTracks = presenter
    ? cameraTrackReferences.filter(
        (track) => track.participant.identity === presenter,
      )
    : cameraTrackReferences;

  const primaryTrack = screenShareTrack || presenterCameraTracks[0];

  if (!primaryTrack) {
    return <EmptyState />;
  }

  const isScreenShare = !!screenShareTrack;

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2 flex items-center justify-center">
      <div
        className={`relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full ${isScreenShare ? "h-full" : "aspect-video"}`}
      >
        <ParticipantTile
          trackRef={primaryTrack}
          disableSpeakingIndicator={true}
          className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
        />
      </div>
    </div>
  );
}

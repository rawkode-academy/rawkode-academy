import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import type { LayoutProps } from "./types";

export function PresentationLayout({
  cameraTrackReferences,
  screenShareTrack,
}: LayoutProps) {
  const participantCount = cameraTrackReferences.length;

  if (participantCount === 0 && !screenShareTrack) {
    return <EmptyState />;
  }

  // Handle camera-only scenarios (no screen share)
  if (!screenShareTrack) {
    if (participantCount === 1 && cameraTrackReferences[0]) {
      // Single camera - centered fullscreen
      return (
        <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full aspect-video">
              <ParticipantTile
                trackRef={cameraTrackReferences[0]}
                disableSpeakingIndicator={true}
                className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
              />
            </div>
          </div>
        </div>
      );
    }

    if (participantCount === 2) {
      // Two cameras - side by side, centered
      return (
        <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
          <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2 place-items-center">
            {cameraTrackReferences.map((track) => (
              <div
                key={track.publication?.trackSid}
                className="relative w-full aspect-video"
              >
                <div className="absolute inset-0 overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900">
                  <ParticipantTile
                    trackRef={track}
                    disableSpeakingIndicator={true}
                    className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // Screen share with overlay participants
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black relative p-2">
      {/* Main content - screen share or primary camera */}
      <div className="w-full h-full flex items-center justify-center">
        <div className="relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full h-full">
          <ParticipantTile
            trackRef={screenShareTrack || cameraTrackReferences[0]}
            disableSpeakingIndicator={true}
            className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
          />
        </div>
      </div>

      {/* Participant overlays - positioned based on count */}
      {screenShareTrack && participantCount > 0 && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          {cameraTrackReferences.slice(0, 3).map((track) => (
            <div
              key={track.publication?.trackSid}
              className="w-64 xl:w-80 aspect-video"
            >
              <div className="relative overflow-hidden shadow-xl ring-1 ring-gray-300/30 hover:ring-gray-400/40 dark:ring-white/10 dark:hover:ring-white/20 bg-gray-900 w-full h-full">
                <ParticipantTile
                  trackRef={track}
                  disableSpeakingIndicator={true}
                  className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show remaining count if more than 3 participants */}
      {screenShareTrack && participantCount > 3 && (
        <div className="absolute bottom-4 left-4 bg-gray-900/90 text-white px-3 py-1 rounded text-sm">
          +{participantCount - 3} more
        </div>
      )}
    </div>
  );
}

import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import type { LayoutProps } from "./types";

export function SideBySideLayout({
  cameraTrackReferences,
  screenShareTrack,
  presenter,
}: LayoutProps) {
  // In side-by-side layout, only show presenter cameras
  const presenterCameraTracks = presenter
    ? cameraTrackReferences.filter(
        (track) => track.participant.identity === presenter,
      )
    : cameraTrackReferences;

  const tracks = screenShareTrack
    ? [screenShareTrack, presenterCameraTracks[0]].filter(Boolean)
    : presenterCameraTracks.slice(0, 2);

  if (tracks.length === 0) {
    return <EmptyState />;
  }

  // Single track - fullscreen
  if (tracks.length === 1) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
        <div className="w-full h-full flex items-center justify-center">
          <div className="relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full aspect-video">
            <ParticipantTile
              trackRef={tracks[0]}
              disableSpeakingIndicator={true}
              className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
            />
          </div>
        </div>
      </div>
    );
  }

  // Two tracks - side by side (stacked on mobile)
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
      <div className="w-full h-full grid grid-cols-1 md:grid-cols-2 gap-2 place-items-center">
        {tracks.map((track, index) => (
          <div
            key={track?.publication?.trackSid || index}
            className="relative w-full aspect-video"
          >
            <div className="absolute inset-0 overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900">
              {track && (
                <ParticipantTile
                  trackRef={track}
                  disableSpeakingIndicator={true}
                  className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

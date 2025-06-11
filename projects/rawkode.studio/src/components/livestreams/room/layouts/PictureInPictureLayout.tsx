import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import { ParticipantNameplate } from "./ParticipantNameplate";
import type { LayoutProps } from "./types";

export function PictureInPictureLayout({
  cameraTrackReferences,
  screenShareTrack,
  presenter,
}: LayoutProps) {
  // In PiP layout, only show presenter cameras
  const presenterCameraTracks = presenter
    ? cameraTrackReferences.filter(
        (track) => track.participant.identity === presenter,
      )
    : cameraTrackReferences;

  const mainTrack = screenShareTrack || presenterCameraTracks[0];
  const pipTrack = screenShareTrack
    ? presenterCameraTracks[0]
    : presenterCameraTracks[1];

  if (!mainTrack) {
    return <EmptyState />;
  }

  const isScreenShare = !!screenShareTrack;

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black relative p-2">
      {/* Main content */}
      <div className="w-full h-full flex items-center justify-center">
        {mainTrack && (
          <div
            className={`relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full ${isScreenShare ? "h-full" : "aspect-video"}`}
          >
            <ParticipantTile
              trackRef={mainTrack}
              disableSpeakingIndicator={true}
              className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
            />
            {!isScreenShare && <ParticipantNameplate trackRef={mainTrack} />}
          </div>
        )}
      </div>

      {/* PiP overlay */}
      {pipTrack && (
        <div className="absolute bottom-4 right-4 w-1/4 min-w-[200px] max-w-[350px] aspect-video">
          <div className="relative overflow-hidden shadow-xl ring-1 ring-gray-300/30 hover:ring-gray-400/40 dark:ring-white/10 dark:hover:ring-white/20 bg-gray-900 w-full h-full">
            <ParticipantTile
              trackRef={pipTrack}
              disableSpeakingIndicator={true}
              className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
            />
            <ParticipantNameplate trackRef={pipTrack} size="small" />
          </div>
        </div>
      )}
    </div>
  );
}

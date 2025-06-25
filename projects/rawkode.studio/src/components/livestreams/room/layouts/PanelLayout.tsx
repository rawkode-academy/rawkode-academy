import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import { ParticipantNameplate } from "./ParticipantNameplate";
import type { LayoutProps } from "./types";

export function PanelLayout({
  cameraTrackReferences,
  screenShareTrack,
}: LayoutProps) {
  const participantCount = cameraTrackReferences.length;

  if (participantCount === 0 && !screenShareTrack) {
    return <EmptyState />;
  }

  // With screen share - like PictureInPictureLayout but with bottom participants
  if (screenShareTrack) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black relative p-2">
        {/* Main screen share */}
        <div className="w-full h-full flex items-center justify-center">
          <div className="relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full h-full">
            <ParticipantTile
              trackRef={screenShareTrack}
              disableSpeakingIndicator={true}
              className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
            />
          </div>
        </div>

        {/* Participants overlay at bottom, full width */}
        {participantCount > 0 && (
          <div className="absolute bottom-2 left-0 right-0 p-2">
            <div className="flex gap-2 justify-center">
              {cameraTrackReferences.slice(0, 4).map((track) => (
                <div
                  key={track.publication?.trackSid}
                  className="w-1/4 min-w-[200px] max-w-[350px] aspect-video"
                >
                  <div className="relative overflow-hidden shadow-xl ring-1 ring-gray-300/30 hover:ring-gray-400/40 dark:ring-white/10 dark:hover:ring-white/20 bg-gray-900 w-full h-full">
                    <ParticipantTile
                      trackRef={track}
                      disableSpeakingIndicator={true}
                      className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
                    />
                    <ParticipantNameplate trackRef={track} size="small" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Without screen share - like GridLayout
  const getGridClass = () => {
    if (participantCount === 1) {
      return "grid-cols-1";
    }
    if (participantCount === 2) {
      return "grid-cols-1 md:grid-cols-2";
    }
    if (participantCount <= 4) {
      return "grid-cols-1 sm:grid-cols-2";
    }
    if (participantCount <= 6) {
      return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    }
    if (participantCount <= 9) {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
    }
    if (participantCount <= 12) {
      return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4";
    }
    return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
      <div className={`grid ${getGridClass()} gap-2 w-full h-full`}>
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
              <ParticipantNameplate
                trackRef={track}
                size={participantCount > 4 ? "small" : "default"}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import { ParticipantNameplate } from "./ParticipantNameplate";
import type { LayoutProps } from "./types";

export function GridLayout({ cameraTrackReferences }: LayoutProps) {
  const participantCount = cameraTrackReferences.length;

  if (participantCount === 0) {
    return <EmptyState />;
  }

  // Optimize grid layout based on participant count
  const getGridClass = () => {
    if (participantCount === 1) {
      return "grid-cols-1 grid-rows-1";
    }
    if (participantCount === 2) {
      return "grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1";
    }
    if (participantCount <= 4) {
      return "grid-cols-1 grid-rows-4 sm:grid-cols-2 sm:grid-rows-2";
    }
    if (participantCount <= 6) {
      return "grid-cols-1 grid-rows-6 sm:grid-cols-2 sm:grid-rows-3 lg:grid-cols-3 lg:grid-rows-2";
    }
    if (participantCount <= 9) {
      return "grid-cols-1 grid-rows-9 sm:grid-cols-2 sm:grid-rows-5 md:grid-cols-3 md:grid-rows-3";
    }
    if (participantCount <= 12) {
      return "grid-cols-1 grid-rows-12 sm:grid-cols-2 sm:grid-rows-6 md:grid-cols-3 md:grid-rows-4 xl:grid-cols-4 xl:grid-rows-3";
    }
    if (participantCount <= 16) {
      return "grid-cols-2 grid-rows-8 md:grid-cols-4 md:grid-rows-4";
    }
    return "grid-cols-2 grid-rows-10 md:grid-cols-3 md:grid-rows-7 lg:grid-cols-4 lg:grid-rows-5 2xl:grid-cols-5 2xl:grid-rows-4";
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
      <div className={`grid ${getGridClass()} gap-2 w-full h-full`}>
        {cameraTrackReferences.map((track, index) => (
          <div
            key={
              track.publication?.trackSid ||
              `participant-${track.participant.sid}-${index}`
            }
            className="relative min-h-0 min-w-0 flex items-center justify-center"
          >
            <div className="relative w-full max-w-full aspect-video overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900">
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

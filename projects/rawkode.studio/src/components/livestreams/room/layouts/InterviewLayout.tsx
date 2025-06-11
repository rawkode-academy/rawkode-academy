import { ParticipantTile } from "@livekit/components-react";
import { EmptyState } from "./EmptyState";
import type { LayoutProps } from "./types";

export function InterviewLayout({ cameraTrackReferences }: LayoutProps) {
  const participants = cameraTrackReferences.slice(0, 3);

  if (participants.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
      <div className="w-full h-full flex flex-col md:flex-row md:flex-wrap gap-2 md:content-center md:justify-center">
        {/* First two participants side by side on desktop */}
        {participants.slice(0, 2).map((track) => (
          <div
            key={track.publication?.trackSid}
            className="relative w-full md:w-[calc(50%-0.25rem)] aspect-video"
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

        {/* Third participant below, centered on desktop */}
        {participants[2] && (
          <div className="relative w-full md:w-1/2 aspect-video">
            <div className="absolute inset-0 overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900">
              <ParticipantTile
                trackRef={participants[2]}
                disableSpeakingIndicator={true}
                className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { ParticipantTile } from "@livekit/components-react";
import { getGridClass } from "@/lib/layout";
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

  // With screen share - vertical layout with participants below
  if (screenShareTrack) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2 flex flex-col gap-2">
        {/* Main screen share - takes up available space */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-full flex items-center justify-center">
            <div className="relative overflow-hidden shadow-lg ring-1 ring-gray-300/20 hover:ring-gray-400/30 dark:ring-white/5 dark:hover:ring-white/10 bg-gray-900 w-full h-full">
              <ParticipantTile
                trackRef={screenShareTrack}
                disableSpeakingIndicator={true}
                className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Participants row at bottom - fixed height */}
        {participantCount > 0 && (
          <div className="h-[100px] sm:h-[120px] md:h-[150px] lg:h-[180px] shrink-0">
            <div className="h-full flex gap-2 justify-center">
              {cameraTrackReferences.slice(0, 4).map((track) => (
                <div
                  key={track.publication?.trackSid}
                  className="h-full aspect-video"
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

  // Without screen share - grid layout
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-900 dark:via-gray-950 dark:to-black p-2">
      <div
        className={`grid ${getGridClass(participantCount)} gap-2 w-full h-full`}
      >
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

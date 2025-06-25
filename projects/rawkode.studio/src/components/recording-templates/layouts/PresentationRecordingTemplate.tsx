import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { layoutStyles } from "@/lib/layout";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function PresentationRecordingTemplate() {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  const screenShare = screenShareTracks[0];
  const cameras = cameraTracks.slice(0, 3);
  const participantCount = cameras.length;

  if (participantCount === 0 && !screenShare) {
    return (
      <div
        className={`${layoutStyles.container} flex items-center justify-center`}
      >
        <div className="text-gray-400 text-center">
          <p className="text-xl">Waiting for participants...</p>
        </div>
      </div>
    );
  }

  // Handle camera-only scenarios (no screen share)
  if (!screenShare) {
    if (participantCount === 1 && cameras[0]) {
      // Single camera - centered fullscreen
      return (
        <div className={layoutStyles.containerWithPadding}>
          <div className="w-full h-full flex items-center justify-center">
            <div
              className={`${layoutStyles.participantTile} w-full aspect-video`}
            >
              <RecordingParticipantTile
                trackRef={cameras[0]}
                showNameplate={true}
              />
            </div>
          </div>
        </div>
      );
    }

    if (participantCount === 2) {
      // Two cameras - side by side, centered
      return (
        <div className={layoutStyles.containerWithPadding}>
          <div className="w-full h-full grid grid-cols-2 gap-2 place-items-center">
            {cameras.map((track) => (
              <div
                key={track.publication?.trackSid}
                className="relative w-full aspect-video"
              >
                <div className={layoutStyles.participantTile}>
                  <RecordingParticipantTile
                    trackRef={track}
                    showNameplate={true}
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
    <div className={`${layoutStyles.containerWithPadding} relative`}>
      {/* Main content - screen share or primary camera */}
      <div className="w-full h-full flex items-center justify-center">
        <div className={`${layoutStyles.participantTile} w-full h-full`}>
          <RecordingParticipantTile
            trackRef={screenShare || cameras[0]}
            showNameplate={!screenShare}
          />
        </div>
      </div>

      {/* Participant overlays - positioned based on count */}
      {screenShare && participantCount > 0 && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          {cameras.slice(0, 3).map((track) => (
            <div
              key={track.publication?.trackSid}
              className="w-64 xl:w-80 aspect-video"
            >
              <div
                className={`${layoutStyles.participantTile} shadow-xl ring-white/10 w-full h-full`}
              >
                <RecordingParticipantTile
                  trackRef={track}
                  showNameplate={true}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Show remaining count if more than 3 participants */}
      {screenShare && participantCount > 3 && (
        <div className="absolute bottom-4 left-4 bg-gray-900/90 text-white px-3 py-1 rounded text-sm">
          +{participantCount - 3} more
        </div>
      )}
    </div>
  );
}

import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { layoutStyles } from "@/lib/layout";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function SingleSpeakerRecordingTemplate() {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  // Prioritize screen share over camera
  const primaryTrack = screenShareTracks[0] || cameraTracks[0];
  const isScreenShare = !!screenShareTracks[0];

  if (!primaryTrack) {
    return (
      <div
        className={`h-full w-full flex items-center justify-center ${layoutStyles.container}`}
      >
        <div className="text-gray-400 text-center">
          <p className="text-lg">Waiting for presenter...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${layoutStyles.containerWithPadding} flex items-center justify-center`}
    >
      <div
        className={`${layoutStyles.participantTile} w-full ${isScreenShare ? "h-full" : "aspect-video"}`}
      >
        <RecordingParticipantTile
          trackRef={primaryTrack}
          showNameplate={!isScreenShare}
        />
      </div>
    </div>
  );
}

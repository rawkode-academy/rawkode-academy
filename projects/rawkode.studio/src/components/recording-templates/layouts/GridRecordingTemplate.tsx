import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { getGridClass, layoutStyles } from "@/lib/layout";
import { ParticipantTileWrapper } from "../ParticipantTileWrapper";
import { RecordingEmptyState } from "../RecordingEmptyState";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function GridRecordingTemplate() {
  const tracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  });

  const participantCount = tracks.length;

  if (participantCount === 0) {
    return <RecordingEmptyState />;
  }

  return (
    <div className={layoutStyles.containerWithPadding}>
      <div
        className={`grid ${getGridClass(participantCount, true)} gap-2 w-full h-full place-items-center`}
      >
        {tracks.map((track) => (
          <ParticipantTileWrapper key={track.participant.identity}>
            <RecordingParticipantTile
              trackRef={track}
              showNameplate={true}
              nameplateSize={participantCount > 4 ? "small" : "default"}
            />
          </ParticipantTileWrapper>
        ))}
      </div>
    </div>
  );
}

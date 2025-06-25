import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { getGridClass, layoutStyles } from "@/lib/layout";
import { ParticipantTileWrapper } from "../ParticipantTileWrapper";
import { RecordingEmptyState } from "../RecordingEmptyState";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function PanelRecordingTemplate() {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  const screenShare = screenShareTracks[0];
  const panelists = cameraTracks;
  const participantCount = panelists.length;

  if (participantCount === 0 && !screenShare) {
    return <RecordingEmptyState />;
  }

  // With screen share - vertical layout with participants below
  if (screenShare) {
    return (
      <div
        className={`${layoutStyles.containerWithPadding} flex flex-col gap-2`}
      >
        {/* Main screen share - takes up available space */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-full flex items-center justify-center">
            <div className={`${layoutStyles.participantTile} w-full h-full`}>
              <RecordingParticipantTile
                trackRef={screenShare}
                showNameplate={false}
              />
            </div>
          </div>
        </div>

        {/* Participants row at bottom - fixed height */}
        {participantCount > 0 && (
          <div className="h-[120px] md:h-[150px] lg:h-[180px] shrink-0">
            <div className="h-full flex gap-2 justify-center">
              {panelists.slice(0, 4).map((track) => (
                <div
                  key={track.publication?.trackSid}
                  className="h-full aspect-video"
                >
                  <div
                    className={`${layoutStyles.participantTile} shadow-xl ring-white/10 w-full h-full`}
                  >
                    <RecordingParticipantTile
                      trackRef={track}
                      showNameplate={true}
                      nameplateSize="small"
                    />
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
    <div className={layoutStyles.containerWithPadding}>
      <div
        className={`grid ${getGridClass(participantCount, true)} gap-2 w-full h-full place-items-center`}
      >
        {panelists.map((track) => (
          <ParticipantTileWrapper key={track.publication?.trackSid}>
            <RecordingParticipantTile trackRef={track} showNameplate={true} />
          </ParticipantTileWrapper>
        ))}
      </div>
    </div>
  );
}

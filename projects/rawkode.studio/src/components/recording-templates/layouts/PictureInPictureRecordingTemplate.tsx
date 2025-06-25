import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function PictureInPictureRecordingTemplate() {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  const mainTrack = screenShareTracks[0] || cameraTracks[0];
  const pipTrack =
    screenShareTracks.length > 0 ? cameraTracks[0] : cameraTracks[1];

  const isScreenShare = !!screenShareTracks[0];

  if (!mainTrack) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <p className="text-xl">Waiting for participants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black relative p-2">
      {/* Main content */}
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`relative overflow-hidden shadow-lg ring-1 ring-white/5 bg-gray-900 w-full ${isScreenShare ? "h-full" : "aspect-video"}`}
        >
          <RecordingParticipantTile
            trackRef={mainTrack}
            showNameplate={!isScreenShare}
          />
        </div>
      </div>

      {/* PiP overlay */}
      {pipTrack && (
        <div className="absolute bottom-4 right-4 w-1/4 min-w-[200px] max-w-[350px] aspect-video">
          <div className="relative overflow-hidden shadow-xl ring-1 ring-white/10 bg-gray-900 w-full h-full">
            <RecordingParticipantTile
              trackRef={pipTrack}
              showNameplate={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}

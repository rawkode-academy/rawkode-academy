import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function SideBySideRecordingTemplate() {
  const cameraTracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: true,
  });

  // Build tracks array: if screen share exists, pair it with first camera
  const screenShare = screenShareTracks[0];
  const tracks = screenShare
    ? [screenShare, cameraTracks[0]].filter(Boolean)
    : cameraTracks.slice(0, 2);

  // Empty state
  if (tracks.length === 0) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <p className="text-xl">Waiting for participants...</p>
        </div>
      </div>
    );
  }

  // Single track - fullscreen centered
  if (tracks.length === 1) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black p-2">
        <div className="w-full h-full flex items-center justify-center">
          <div className="relative overflow-hidden shadow-lg ring-1 ring-white/5 bg-gray-900 w-full aspect-video">
            <RecordingParticipantTile
              trackRef={tracks[0]}
              showNameplate={tracks[0].source !== Track.Source.ScreenShare}
            />
          </div>
        </div>
      </div>
    );
  }

  // Two tracks - side by side
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black p-2">
      <div className="w-full h-full grid grid-cols-2 gap-2 place-items-center">
        {tracks.map((track, index) => (
          <div
            key={`${track.participant.identity}-${track.publication?.trackSid || index}`}
            className="relative w-full aspect-video"
          >
            <div className="absolute inset-0 overflow-hidden shadow-lg ring-1 ring-white/5 bg-gray-900">
              <RecordingParticipantTile
                trackRef={track}
                showNameplate={track.source !== Track.Source.ScreenShare}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

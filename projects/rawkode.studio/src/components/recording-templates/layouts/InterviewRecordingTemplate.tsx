import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { RecordingParticipantTile } from "../RecordingParticipantTile";

export function InterviewRecordingTemplate() {
  const tracks = useTracks([Track.Source.Camera], {
    onlySubscribed: true,
  }).slice(0, 4); // Max 4 participants for interview

  const participantCount = tracks.length;

  if (participantCount === 0) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <p className="text-xl">Waiting for participants...</p>
        </div>
      </div>
    );
  }

  // Optimize grid layout based on participant count (matching InterviewLayout.tsx)
  const getGridClass = () => {
    if (participantCount === 1) {
      return "grid-cols-1";
    }
    if (participantCount === 2) {
      return "grid-cols-2";
    }
    if (participantCount <= 4) {
      return "grid-cols-2";
    }
    return "grid-cols-2";
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-gray-950 to-black p-2">
      <div
        className={`grid ${getGridClass()} gap-2 w-full h-full place-items-center`}
      >
        {tracks.map((track) => (
          <div
            key={track.publication?.trackSid}
            className="relative w-full aspect-video"
          >
            <div className="absolute inset-0 overflow-hidden shadow-lg ring-1 ring-white/5 bg-gray-900">
              <RecordingParticipantTile trackRef={track} showNameplate={true} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import {
  ParticipantTile,
  type TrackReference,
} from "@livekit/components-react";
import { ParticipantNameplate } from "@/components/livestreams/room/layouts/ParticipantNameplate";

interface RecordingParticipantTileProps {
  trackRef: TrackReference;
  showNameplate?: boolean;
  className?: string;
  nameplateSize?: "small" | "default";
}

export function RecordingParticipantTile({
  trackRef,
  showNameplate = true,
  className = "",
  nameplateSize = "default",
}: RecordingParticipantTileProps) {
  const isScreenShare = trackRef.source === "screen_share";

  return (
    <div className={`relative w-full h-full ${className}`}>
      <ParticipantTile
        trackRef={trackRef}
        disableSpeakingIndicator={true}
        className="absolute inset-0 w-full h-full [&_.lk-participant-tile]:rounded-none"
      />
      {showNameplate && !isScreenShare && (
        <ParticipantNameplate trackRef={trackRef} size={nameplateSize} />
      )}
    </div>
  );
}

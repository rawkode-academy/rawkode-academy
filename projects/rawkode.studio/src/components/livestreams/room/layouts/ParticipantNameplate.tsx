import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";

interface ParticipantNameplateProps {
  trackRef: TrackReferenceOrPlaceholder;
  size?: "small" | "default";
}

export function ParticipantNameplate({
  trackRef,
  size = "default",
}: ParticipantNameplateProps) {
  const name =
    trackRef.participant?.name || trackRef.participant?.identity || "Unknown";

  const isSmall = size === "small";

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-white/5 backdrop-blur-sm border-t border-white/10">
      <div className={isSmall ? "px-2 py-0.5" : "px-4 py-1"}>
        <p
          className={`text-white text-right font-semibold truncate ${
            isSmall ? "text-xs md:text-sm" : "text-base md:text-lg"
          }`}
        >
          {name}
        </p>
      </div>
    </div>
  );
}

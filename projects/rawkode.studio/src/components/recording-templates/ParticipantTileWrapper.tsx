import type { ReactNode } from "react";
import { layoutStyles } from "@/lib/layout";

interface ParticipantTileWrapperProps {
  children: ReactNode;
  className?: string;
  aspectRatio?: "video" | "full";
}

export function ParticipantTileWrapper({
  children,
  className = "",
  aspectRatio = "video",
}: ParticipantTileWrapperProps) {
  const aspectClass = aspectRatio === "video" ? "aspect-video" : "h-full";

  return (
    <div className={`relative w-full ${aspectClass} ${className}`}>
      <div className={layoutStyles.participantTile}>{children}</div>
    </div>
  );
}

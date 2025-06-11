import { RaiseHandContext } from "@/components/livestreams/room/controls/RaiseHandContext";
import { RoomControls } from "@/components/livestreams/room/controls/RoomControls";
import { useRoomPermissions } from "@/components/livestreams/room/hooks/useRoomPermissions";
import { RaisedHandsList } from "@/components/livestreams/room/participants/RaisedHandsList";
import { Separator } from "@/components/shadcn/separator";
import { useRoomContext } from "@livekit/components-react";
import { useContext } from "react";

interface ControlsSectionProps {
  token: string | null;
}

export function ControlsSection({ token }: ControlsSectionProps) {
  const room = useRoomContext();
  const permissions = useRoomPermissions();
  const { raisedHands } = useContext(RaiseHandContext);

  const handlePromote = async (participantIdentity: string) => {
    if (!room?.name) return;

    try {
      const response = await fetch("/api/livestream/participant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
        body: JSON.stringify({
          roomName: room.name,
          participantIdentity,
          action: "promote",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to promote participant:", error);
      }
    } catch (error) {
      console.error("Failed to promote participant:", error);
    }
  };

  return (
    <div className="space-y-3">
      <RoomControls token={token} />
      {permissions.canLowerHands && raisedHands.size > 0 && (
        <>
          <Separator className="opacity-20" />
          <RaisedHandsList onPromote={handlePromote} token={token} />
        </>
      )}
    </div>
  );
}

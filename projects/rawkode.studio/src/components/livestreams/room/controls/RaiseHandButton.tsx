import { useRoomPermissions } from "@/components/livestreams/room/hooks/useRoomPermissions";
import { Button } from "@/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { cn } from "@/lib/utils";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Hand } from "lucide-react";
import { useContext, useState } from "react";
import { RaiseHandContext } from "./RaiseHandContext";

interface RaiseHandButtonProps {
  className?: string;
  token: string | null;
}

export function RaiseHandButton({ className, token }: RaiseHandButtonProps) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const permissions = useRoomPermissions();
  const [isUpdating, setIsUpdating] = useState(false);
  const { raisedHands } = useContext(RaiseHandContext);

  const handRaised = raisedHands.has(localParticipant?.identity || "");

  const toggleHand = async () => {
    if (!localParticipant || !room || isUpdating) return;

    const newHandState = !handRaised;
    setIsUpdating(true);

    try {
      // Use API endpoint to send data message from backend
      const response = await fetch("/api/livestream/participant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          roomName: room.name,
          action: "raise_hand_request",
          raised: newHandState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Raise hand request failed:", errorData);
      }
    } catch (error) {
      console.error("Raise hand request failed:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Only show if the user has permission to raise hand AND is not already a speaker
  if (!permissions.canRaiseHand || localParticipant?.permissions?.canPublish) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={handRaised ? "default" : "outline"}
          size="icon"
          onClick={toggleHand}
          disabled={isUpdating}
          className={cn(
            "h-9 w-full rounded-md transition-all hover:scale-105",
            className,
          )}
        >
          <Hand className={`h-4 w-4 ${handRaised ? "animate-pulse" : ""}`} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isUpdating
            ? "Updating..."
            : handRaised
              ? "Cancel your request to speak"
              : "Request to join the stage"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

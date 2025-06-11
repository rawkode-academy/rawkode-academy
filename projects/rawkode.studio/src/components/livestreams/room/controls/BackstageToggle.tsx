import { Button } from "@/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";
import { useLocalParticipant } from "@livekit/components-react";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";

export function BackstageToggle() {
  const { localParticipant } = useLocalParticipant();
  const [isBackstage, setIsBackstage] = useState(false);
  const [previousState, setPreviousState] = useState({
    camera: false,
    microphone: false,
    screenShare: false,
  });

  const toggleBackstage = async () => {
    if (!localParticipant) return;

    const newBackstageState = !isBackstage;
    setIsBackstage(newBackstageState);

    try {
      if (newBackstageState) {
        // Store current state before going backstage
        setPreviousState({
          camera: localParticipant.isCameraEnabled,
          microphone: localParticipant.isMicrophoneEnabled,
          screenShare: localParticipant.isScreenShareEnabled,
        });

        // Go backstage - disable camera, mic, and screen share
        const promises = [];
        if (localParticipant.isCameraEnabled) {
          promises.push(localParticipant.setCameraEnabled(false));
        }
        if (localParticipant.isMicrophoneEnabled) {
          promises.push(localParticipant.setMicrophoneEnabled(false));
        }
        if (localParticipant.isScreenShareEnabled) {
          promises.push(localParticipant.setScreenShareEnabled(false));
        }
        await Promise.all(promises);
      } else {
        // Return from backstage - restore previous state
        const promises = [];

        // Only try to enable devices that were previously enabled
        if (previousState.camera) {
          promises.push(
            localParticipant.setCameraEnabled(true).catch((err) => {
              console.warn("Could not re-enable camera:", err);
            }),
          );
        }
        if (previousState.microphone) {
          promises.push(
            localParticipant.setMicrophoneEnabled(true).catch((err) => {
              console.warn("Could not re-enable microphone:", err);
            }),
          );
        }
        if (previousState.screenShare) {
          promises.push(
            localParticipant.setScreenShareEnabled(true).catch((err) => {
              console.warn("Could not re-enable screen share:", err);
            }),
          );
        }

        await Promise.all(promises);
      }

      // Note: Updating metadata to indicate backstage status requires server-side action
      // For now, we'll just manage the local state
    } catch (error) {
      console.error("Failed to toggle backstage:", error);
      setIsBackstage(!newBackstageState); // Revert on error
    }
  };

  // Reset backstage state if permissions change
  useEffect(() => {
    if (!localParticipant?.permissions?.canPublish) {
      setIsBackstage(false);
    }
  }, [localParticipant?.permissions?.canPublish]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant={isBackstage ? "secondary" : "default"}
          className="h-9 w-full rounded-md transition-all hover:scale-105"
          onClick={toggleBackstage}
          disabled={false}
        >
          {isBackstage ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isBackstage ? "Return to stage" : "Go backstage"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

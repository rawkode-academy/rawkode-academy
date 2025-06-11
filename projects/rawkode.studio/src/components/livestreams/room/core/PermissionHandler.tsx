import { useLocalParticipant } from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function PermissionHandler() {
  const { localParticipant } = useLocalParticipant();
  const previousCanPublish = useRef<boolean | null>(null);
  const hasShownInitialToast = useRef(false);

  // Check if user is a director from attributes
  const participantRole = localParticipant?.attributes?.role || "viewer";
  const isDirector = participantRole === "director";

  useEffect(() => {
    if (!localParticipant) return;

    // Store initial permission state
    if (previousCanPublish.current === null) {
      previousCanPublish.current =
        localParticipant.permissions?.canPublish || false;
      // Don't show toast on initial load for directors
      if (isDirector) {
        hasShownInitialToast.current = true;
      }
    }

    // Listen for permission changes
    const handlePermissionsChanged = () => {
      const currentCanPublish =
        localParticipant.permissions?.canPublish || false;
      const wasAbleToPublish = previousCanPublish.current || false;
      const attributes = localParticipant.attributes || {};

      // Re-check director status from attributes
      const currentRole = localParticipant?.attributes?.role || "viewer";
      const currentIsDirector = currentRole === "director";

      console.log("Permission change detected:", {
        previous: wasAbleToPublish,
        current: currentCanPublish,
        isDirector: currentIsDirector,
        attributes,
      });

      // Only show notifications if this is a real permission change, not initial load
      const isRealChange =
        previousCanPublish.current !== null &&
        previousCanPublish.current !== currentCanPublish;

      // Show appropriate notification (skip for directors and initial load)
      if (
        !currentIsDirector &&
        isRealChange &&
        !wasAbleToPublish &&
        currentCanPublish
      ) {
        toast.success("You've been promoted to speaker! 🎤", {
          description: "You can now share your camera and microphone.",
          duration: 5000,
        });
        hasShownInitialToast.current = true;
      } else if (
        !currentIsDirector &&
        isRealChange &&
        wasAbleToPublish &&
        !currentCanPublish
      ) {
        toast.info("You've been moved to viewer mode", {
          description: "You can still watch and participate in chat.",
          duration: 5000,
        });
      }

      // Update the stored state
      previousCanPublish.current = currentCanPublish;
    };

    // Subscribe to permission changes
    localParticipant.on(
      ParticipantEvent.ParticipantPermissionsChanged,
      handlePermissionsChanged,
    );

    // Also listen for attribute changes (which might include permission metadata)
    const handleAttributesChanged = () => {
      // Trigger permission check when attributes change
      handlePermissionsChanged();
    };

    localParticipant.on(
      ParticipantEvent.AttributesChanged,
      handleAttributesChanged,
    );

    return () => {
      localParticipant.off(
        ParticipantEvent.ParticipantPermissionsChanged,
        handlePermissionsChanged,
      );
      localParticipant.off(
        ParticipantEvent.AttributesChanged,
        handleAttributesChanged,
      );
    };
  }, [localParticipant, isDirector]);

  return null;
}

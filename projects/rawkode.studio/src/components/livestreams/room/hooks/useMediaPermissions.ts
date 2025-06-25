import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import { useLayout } from "@/components/livestreams/room/core/LayoutContext";
import {
  type ControlPermissions,
  getPermissionReason,
  LAYOUT_PERMISSIONS,
  type LayoutType,
  type MediaPermissions,
  parseRoomMetadata,
  ROLE_PERMISSIONS,
} from "@/components/livestreams/room/layouts/permissions";

export interface MediaButtonState {
  enabled: boolean;
  tooltip: string;
  isActive: boolean;
}

export interface MediaButtonStates {
  microphone: MediaButtonState;
  camera: MediaButtonState;
  screenShare: MediaButtonState;
}

export interface UseMediaPermissionsResult {
  // Base permissions from LiveKit token
  canPublish: boolean;
  canPublishData: boolean;

  // User role information
  isDirector: boolean;
  isPresenter: boolean;
  role: "director" | "presenter" | "participant" | "viewer";

  // Computed media permissions based on role and layout
  mediaPermissions: MediaPermissions;

  // Control permissions based on role
  controlPermissions: ControlPermissions;

  // Button states with enabled/disabled status and tooltips
  buttonStates: MediaButtonStates;

  // Current layout information
  currentLayout: LayoutType;
}

export function useMediaPermissions(): UseMediaPermissionsResult {
  const { localParticipant } = useLocalParticipant();
  const { currentLayout } = useLayout();
  const roomInfo = useRoomInfo();

  // Default permissions to true initially to prevent UI flickering
  const [basePermissions, setBasePermissions] = useState({
    canPublish: true,
    canPublishData: true,
  });

  // Update base permissions when they change
  useEffect(() => {
    if (!localParticipant) return;

    const updatePermissions = () => {
      const perms = localParticipant.permissions;
      setBasePermissions({
        canPublish: !!perms?.canPublish,
        canPublishData: !!perms?.canPublishData,
      });
    };

    // Initial update
    updatePermissions();

    // Listen for permission changes
    const handlePermissionsChanged = () => {
      updatePermissions();
    };

    localParticipant.on(
      ParticipantEvent.ParticipantPermissionsChanged,
      handlePermissionsChanged,
    );

    return () => {
      localParticipant.off(
        ParticipantEvent.ParticipantPermissionsChanged,
        handlePermissionsChanged,
      );
    };
  }, [localParticipant]);

  // Compute role and permissions
  const result = useMemo(() => {
    const metadata = parseRoomMetadata(roomInfo?.metadata);
    const presenter = metadata?.presenter;

    // Determine user role
    const participantRole = localParticipant?.attributes?.role as
      | string
      | undefined;
    const isDirector = participantRole === "director";
    const isPresenter = localParticipant?.identity === presenter;

    const role: "director" | "presenter" | "participant" | "viewer" = isDirector
      ? "director"
      : isPresenter
        ? "presenter"
        : participantRole === "viewer"
          ? "viewer"
          : participantRole === "participant"
            ? "participant"
            : "viewer";

    // Determine effective role for media permissions
    // If user is a presenter, always use presenter permissions for media
    // This ensures directors who are also presenters get full media access
    const effectiveRole = isPresenter ? "presenter" : role;

    // Get layout-specific media permissions
    const layoutPermissions = LAYOUT_PERMISSIONS[currentLayout];
    const mediaPermissions = layoutPermissions[effectiveRole];

    // Debug logging for permission resolution
    if (isDirector && isPresenter) {
      console.log("[DEBUG] User is both director and presenter:", {
        identity: localParticipant?.identity,
        role,
        effectiveRole,
        currentLayout,
        mediaPermissions,
        timestamp: new Date().toISOString(),
      });
    }

    // Get role-based control permissions
    const controlPermissions = ROLE_PERMISSIONS[role];

    // Compute button states with tooltips
    const buttonStates: MediaButtonStates = {
      microphone: {
        enabled: basePermissions.canPublish && mediaPermissions.microphone,
        tooltip:
          getPermissionReason(
            currentLayout,
            effectiveRole,
            "microphone",
            basePermissions.canPublish,
          ) ||
          (localParticipant?.isMicrophoneEnabled
            ? "Mute microphone"
            : "Unmute microphone"),
        isActive: !!localParticipant?.isMicrophoneEnabled,
      },
      camera: {
        enabled: basePermissions.canPublish && mediaPermissions.camera,
        tooltip:
          getPermissionReason(
            currentLayout,
            effectiveRole,
            "camera",
            basePermissions.canPublish,
          ) ||
          (localParticipant?.isCameraEnabled ? "Stop video" : "Start video"),
        isActive: !!localParticipant?.isCameraEnabled,
      },
      screenShare: {
        enabled: basePermissions.canPublish && mediaPermissions.screenShare,
        tooltip:
          getPermissionReason(
            currentLayout,
            effectiveRole,
            "screenShare",
            basePermissions.canPublish,
          ) ||
          (localParticipant?.isScreenShareEnabled
            ? "Stop sharing screen"
            : "Share screen"),
        isActive: !!localParticipant?.isScreenShareEnabled,
      },
    };

    return {
      canPublish: basePermissions.canPublish,
      canPublishData: basePermissions.canPublishData,
      isDirector,
      isPresenter,
      role,
      mediaPermissions,
      controlPermissions,
      buttonStates,
      currentLayout,
    };
  }, [
    localParticipant,
    roomInfo?.metadata,
    currentLayout,
    basePermissions,
    localParticipant?.isMicrophoneEnabled,
    localParticipant?.isCameraEnabled,
    localParticipant?.isScreenShareEnabled,
    localParticipant?.attributes?.role,
    localParticipant?.identity,
  ]);

  return result;
}

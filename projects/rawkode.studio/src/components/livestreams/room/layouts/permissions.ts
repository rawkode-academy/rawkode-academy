export enum LayoutType {
  SINGLE_SPEAKER = "single-speaker",
  SIDE_BY_SIDE = "side-by-side",
  PICTURE_IN_PICTURE = "picture-in-picture",
  GRID = "grid",
  PRESENTATION = "presentation",
  INTERVIEW = "interview",
  PANEL = "panel",
}

export interface LayoutConfig {
  id: LayoutType;
  name: string;
  description: string;
  icon: string;
}

export const LAYOUT_CONFIGS: Record<LayoutType, LayoutConfig> = {
  [LayoutType.GRID]: {
    id: LayoutType.GRID,
    name: "Grid View",
    description: "Equal-sized grid for multiple participants",
    icon: "Grid3x3",
  },
  [LayoutType.SINGLE_SPEAKER]: {
    id: LayoutType.SINGLE_SPEAKER,
    name: "Single Speaker",
    description: "Full-screen single camera or screenshare",
    icon: "User",
  },
  [LayoutType.SIDE_BY_SIDE]: {
    id: LayoutType.SIDE_BY_SIDE,
    name: "Side by Side",
    description: "Two equal-sized sources horizontally",
    icon: "Users",
  },
  [LayoutType.PICTURE_IN_PICTURE]: {
    id: LayoutType.PICTURE_IN_PICTURE,
    name: "Picture in Picture",
    description: "Main content with small overlay camera",
    icon: "PictureInPicture",
  },
  [LayoutType.PRESENTATION]: {
    id: LayoutType.PRESENTATION,
    name: "Presentation Mode",
    description: "Large screenshare with small camera strip",
    icon: "Presentation",
  },
  [LayoutType.INTERVIEW]: {
    id: LayoutType.INTERVIEW,
    name: "Interview",
    description: "Two cameras with optional lower-third space",
    icon: "MessageSquare",
  },
  [LayoutType.PANEL]: {
    id: LayoutType.PANEL,
    name: "Panel Discussion",
    description: "Horizontal strip of cameras",
    icon: "Users2",
  },
};

export interface RoomLayoutMetadata {
  activeLayout: LayoutType;
  presenter?: string; // Identity of the current presenter
}

export function parseRoomMetadata(
  metadata: string | undefined,
): RoomLayoutMetadata | null {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    if (
      parsed.activeLayout &&
      Object.values(LayoutType).includes(parsed.activeLayout)
    ) {
      return parsed as RoomLayoutMetadata;
    }
  } catch (e) {
    console.error("Failed to parse room metadata:", e);
  }

  return null;
}

export function stringifyRoomMetadata(metadata: RoomLayoutMetadata): string {
  return JSON.stringify(metadata);
}

export function getDefaultLayout(
  hasScreenShare: boolean,
  _participantCount: number,
): LayoutType {
  if (hasScreenShare) {
    return LayoutType.PRESENTATION;
  }

  // Always default to GRID layout regardless of participant count
  return LayoutType.GRID;
}

// Permission types
export interface MediaPermissions {
  microphone: boolean;
  camera: boolean;
  screenShare: boolean;
}

export interface ControlPermissions {
  canToggleBackstage: boolean;
  canSelectPresenter: boolean;
  canSelectLayout: boolean;
  canPromoteParticipants: boolean;
  canDemoteParticipants: boolean;
  canLowerHands: boolean;
  canRaiseHand: boolean;
  canSendChatMessages: boolean;
}

export interface LayoutPermissionRule {
  director: MediaPermissions;
  presenter: MediaPermissions;
  participant: MediaPermissions;
  viewer: MediaPermissions;
  description: string;
}

export const LAYOUT_PERMISSIONS: Record<LayoutType, LayoutPermissionRule> = {
  [LayoutType.GRID]: {
    director: {
      microphone: true,
      camera: true,
      screenShare: false, // Grid doesn't support screen sharing at all
    },
    presenter: {
      microphone: true,
      camera: true,
      screenShare: false,
    },
    participant: {
      microphone: true,
      camera: true,
      screenShare: false,
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description:
      "Grid layout: Everyone can use mic and camera, no screen sharing",
  },
  [LayoutType.SINGLE_SPEAKER]: {
    director: {
      microphone: true,
      camera: false, // Directors must be presenter to use camera
      screenShare: false, // Directors must be presenter to share screen
    },
    presenter: {
      microphone: true,
      camera: true, // Only presenter can use camera
      screenShare: true,
    },
    participant: {
      microphone: true, // Everyone can use mic
      camera: false, // Non-presenters can't use camera
      screenShare: false,
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description:
      "Single speaker: Only presenter can use camera and screen share",
  },
  [LayoutType.PICTURE_IN_PICTURE]: {
    director: {
      microphone: true, // Directors can use microphone in PiP
      camera: false, // Directors need to be presenter for camera
      screenShare: false, // Directors need to be presenter for screen share
    },
    presenter: {
      microphone: true,
      camera: true,
      screenShare: true,
    },
    participant: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description:
      "PiP mode: Only presenter can use camera/screen, directors can use mic",
  },
  [LayoutType.PRESENTATION]: {
    director: {
      microphone: true,
      camera: true,
      screenShare: false, // Directors must be presenter to share screen
    },
    presenter: {
      microphone: true,
      camera: true,
      screenShare: true,
    },
    participant: {
      microphone: true,
      camera: true,
      screenShare: false, // Only presenters can screen share
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description: "Presentation mode: Screen sharing restricted to presenters",
  },
  [LayoutType.SIDE_BY_SIDE]: {
    director: {
      microphone: true,
      camera: false, // Directors must be presenter to use camera in side-by-side
      screenShare: false, // Directors must be presenter to share screen
    },
    presenter: {
      microphone: true,
      camera: true,
      screenShare: true,
    },
    participant: {
      microphone: true,
      camera: false, // Only presenters can use camera in side-by-side
      screenShare: false,
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description:
      "Side-by-side: Only presenters can use camera and screen share",
  },
  [LayoutType.INTERVIEW]: {
    director: {
      microphone: true,
      camera: true,
      screenShare: false,
    },
    presenter: {
      microphone: true,
      camera: true,
      screenShare: false,
    },
    participant: {
      microphone: true,
      camera: true,
      screenShare: false,
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description:
      "Interview: Screen sharing is not available in interview layout",
  },
  [LayoutType.PANEL]: {
    director: {
      microphone: true,
      camera: true,
      screenShare: false, // Directors must be presenter to share screen
    },
    presenter: {
      microphone: true,
      camera: true,
      screenShare: true,
    },
    participant: {
      microphone: true,
      camera: true,
      screenShare: false,
    },
    viewer: {
      microphone: false,
      camera: false,
      screenShare: false,
    },
    description: "Panel: Screen sharing restricted to presenters",
  },
};

export const ROLE_PERMISSIONS: Record<string, ControlPermissions> = {
  director: {
    canToggleBackstage: true,
    canSelectPresenter: true,
    canSelectLayout: true,
    canPromoteParticipants: true,
    canDemoteParticipants: true,
    canLowerHands: true,
    canRaiseHand: false, // Directors don't need to raise hand
    canSendChatMessages: true,
  },
  presenter: {
    canToggleBackstage: false,
    canSelectPresenter: false,
    canSelectLayout: true, // Presenters can change layouts
    canPromoteParticipants: false,
    canDemoteParticipants: false,
    canLowerHands: false,
    canRaiseHand: false, // Presenters don't need to raise hand
    canSendChatMessages: true,
  },
  participant: {
    canToggleBackstage: false,
    canSelectPresenter: false,
    canSelectLayout: false,
    canPromoteParticipants: false,
    canDemoteParticipants: false,
    canLowerHands: false,
    canRaiseHand: true,
    canSendChatMessages: true,
  },
  viewer: {
    canToggleBackstage: false,
    canSelectPresenter: false,
    canSelectLayout: false,
    canPromoteParticipants: false,
    canDemoteParticipants: false,
    canLowerHands: false,
    canRaiseHand: false, // Viewers can't raise hand
    canSendChatMessages: false, // Viewers can't send chat messages
  },
};

export function getPermissionReason(
  layout: LayoutType,
  role: "director" | "presenter" | "participant" | "viewer",
  mediaType: keyof MediaPermissions,
  hasBasePermission: boolean,
): string | null {
  if (!hasBasePermission) {
    return "No permission to publish media";
  }

  const layoutPermissions = LAYOUT_PERMISSIONS[layout];
  const allowed = layoutPermissions[role][mediaType];

  if (!allowed) {
    if (layout === LayoutType.GRID && mediaType === "screenShare") {
      return "Screen sharing is not available in grid layout";
    }

    if (layout === LayoutType.INTERVIEW && mediaType === "screenShare") {
      return "Screen sharing is not available in interview layout";
    }

    if (layout === LayoutType.PICTURE_IN_PICTURE) {
      if (role !== "presenter" && role !== "director") {
        if (mediaType === "microphone") {
          return "Only the presenter and directors can use microphone in PiP mode";
        }
        return "Only the presenter can use camera and screen share in PiP mode";
      }
      if (role === "director" && mediaType !== "microphone") {
        return "Directors must be presenter to use camera or screen share in PiP mode";
      }
    }

    if (layout === LayoutType.SINGLE_SPEAKER) {
      if (mediaType === "camera" && role !== "presenter") {
        return "Only the presenter can use camera in Single Speaker mode";
      }
      if (mediaType === "screenShare" && role !== "presenter") {
        return "Only the presenter can share screen in Single Speaker mode";
      }
    }

    if (layout === LayoutType.SIDE_BY_SIDE) {
      if (mediaType === "camera" && role !== "presenter") {
        return "Only the presenter can use camera in Side-by-Side layout";
      }
    }

    if (mediaType === "screenShare" && role !== "presenter") {
      return "Only presenters can share screen in this layout";
    }
  }

  return null;
}

// Helper function to determine user role
export function getUserRole(
  isDirector: boolean,
  isPresenter: boolean,
  role?: string,
): "director" | "presenter" | "participant" | "viewer" {
  if (isDirector) return "director";
  if (isPresenter) return "presenter";
  if (role === "viewer") return "viewer";
  return "participant";
}

// Check if a specific media type is allowed for the user
export function canUseMedia(
  layout: LayoutType,
  role: "director" | "presenter" | "participant" | "viewer",
  mediaType: keyof MediaPermissions,
  hasBasePermission: boolean,
): boolean {
  if (!hasBasePermission) return false;

  const layoutPermissions = LAYOUT_PERMISSIONS[layout];
  return layoutPermissions[role][mediaType];
}

// Get tooltip text for media controls
export function getMediaTooltip(
  layout: LayoutType,
  role: "director" | "presenter" | "participant" | "viewer",
  mediaType: keyof MediaPermissions,
  hasBasePermission: boolean,
  isEnabled: boolean,
): string {
  const reason = getPermissionReason(
    layout,
    role,
    mediaType,
    hasBasePermission,
  );

  if (reason) return reason;

  // Return appropriate tooltip based on current state
  switch (mediaType) {
    case "microphone":
      return isEnabled ? "Mute microphone" : "Unmute microphone";
    case "camera":
      return isEnabled ? "Stop video" : "Start video";
    case "screenShare":
      return isEnabled ? "Stop screen share" : "Start screen share";
  }
}

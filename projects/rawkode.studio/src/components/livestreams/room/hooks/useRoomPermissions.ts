import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { useMemo } from "react";
import {
  getUserRole,
  parseRoomMetadata,
  ROLE_PERMISSIONS,
} from "@/components/livestreams/room/layouts/permissions";
import { getParticipantRole } from "@/lib/participant";

export interface RoomPermissions {
  isDirector: boolean;
  isPresenter: boolean;
  role: "director" | "presenter" | "participant" | "viewer";
  canPromoteParticipants: boolean;
  canDemoteParticipants: boolean;
  canToggleBackstage: boolean;
  canSelectPresenter: boolean;
  canSelectLayout: boolean;
  canLowerHands: boolean;
  canRaiseHand: boolean;
  canSendChatMessages: boolean;
}

export function useRoomPermissions(): RoomPermissions {
  const { localParticipant } = useLocalParticipant();
  const roomInfo = useRoomInfo();

  return useMemo(() => {
    const participantRole = getParticipantRole(localParticipant);
    const isDirector = participantRole === "director";

    // Check if the local participant is the presenter by comparing with room metadata
    const roomPresenter = parseRoomMetadata(roomInfo?.metadata)?.presenter;
    const isPresenter = localParticipant?.identity === roomPresenter;

    // Determine the effective role
    const role = getUserRole(isDirector, isPresenter, participantRole);
    const permissions = ROLE_PERMISSIONS[role];

    return {
      isDirector,
      isPresenter,
      role,
      canPromoteParticipants: permissions.canPromoteParticipants,
      canDemoteParticipants: permissions.canDemoteParticipants,
      canToggleBackstage: permissions.canToggleBackstage,
      canSelectPresenter: permissions.canSelectPresenter,
      canSelectLayout: permissions.canSelectLayout,
      canLowerHands: permissions.canLowerHands,
      canRaiseHand: permissions.canRaiseHand,
      canSendChatMessages: permissions.canSendChatMessages,
    };
  }, [localParticipant, localParticipant?.identity, roomInfo?.metadata]);
}

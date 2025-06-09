import {
	ROLE_PERMISSIONS,
	getUserRole,
	parseRoomMetadata,
} from "@/components/livestreams/room/layouts/permissions";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { useMemo } from "react";

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
		const participantRole = localParticipant?.attributes?.role as
			| string
			| undefined;
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
	}, [
		localParticipant?.attributes?.role,
		localParticipant?.identity,
		roomInfo?.metadata,
	]);
}

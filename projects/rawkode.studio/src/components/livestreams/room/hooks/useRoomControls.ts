import { useLocalParticipant } from "@livekit/components-react";
import { toast } from "sonner";

async function callParticipantAPI(
	token: string,
	roomName: string,
	action: string,
	participantIdentity?: string,
	additionalData?: Record<string, unknown>,
) {
	const response = await fetch("/api/livestream/participant", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify({
			roomName,
			action,
			participantIdentity,
			...additionalData,
		}),
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Failed to perform action");
	}

	return response.json();
}

export function useRoomControls(token: string, roomName: string) {
	const { localParticipant } = useLocalParticipant();
	const isDirector = localParticipant?.metadata === "director";

	const promoteToPresenter = async (participantId: string) => {
		try {
			await callParticipantAPI(token, roomName, "promote", participantId);
			toast.success("Participant promoted");
		} catch (error) {
			console.error("Failed to promote participant:", error);
			toast.error("Failed to promote participant");
			throw error;
		}
	};

	const demotePresenter = async (participantId: string) => {
		try {
			await callParticipantAPI(token, roomName, "demote", participantId);
			toast.success("Participant demoted");
		} catch (error) {
			console.error("Failed to demote participant:", error);
			toast.error("Failed to demote participant");
			throw error;
		}
	};

	const raiseHand = async () => {
		try {
			await callParticipantAPI(token, roomName, "raise_hand", undefined, {
				raised: true,
			});
			toast.success("Hand raised");
		} catch (error) {
			console.error("Failed to raise hand:", error);
			toast.error("Failed to raise hand");
			throw error;
		}
	};

	const lowerHand = async () => {
		try {
			await callParticipantAPI(token, roomName, "lower_hand");
			toast.success("Hand lowered");
		} catch (error) {
			console.error("Failed to lower hand:", error);
			toast.error("Failed to lower hand");
			throw error;
		}
	};

	const lowerParticipantHand = async (participantId: string) => {
		try {
			await callParticipantAPI(token, roomName, "lower_hand", participantId);
		} catch (error) {
			console.error("Failed to lower participant hand:", error);
			toast.error("Failed to lower participant hand");
			throw error;
		}
	};

	return {
		isDirector,
		promoteToPresenter,
		demotePresenter,
		raiseHand,
		lowerHand,
		lowerParticipantHand,
	};
}

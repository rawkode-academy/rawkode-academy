import { PrejoinScreen } from "@/components/livestreams/prejoin/PrejoinScreen";
import LiveKitRoom from "@/components/livestreams/room/core/LiveKitRoom";
import type { LocalUserChoices } from "@livekit/components-core";
import { useEffect, useState } from "react";

interface RoomWrapperProps {
	serverUrl: string;
	roomName: string;
	roomExists: boolean;
	isDirector: boolean;
	username?: string;
	isAuthenticated: boolean;
}

export function RoomWrapper({
	serverUrl,
	roomName,
	roomExists,
	isDirector,
	username,
	isAuthenticated,
}: RoomWrapperProps) {
	const [showPrejoin, setShowPrejoin] = useState(true);
	const [participantName, setParticipantName] = useState<string | undefined>(
		username,
	);

	// Check if user has already completed prejoin
	useEffect(() => {
		const prejoinCompleted = sessionStorage.getItem("prejoin-completed");
		const lastRoom = sessionStorage.getItem("last-room-name");

		if (prejoinCompleted === "true" && roomName === lastRoom) {
			// User already went through prejoin, skip it
			const savedName = sessionStorage.getItem("participant-name");
			if (savedName) {
				setParticipantName(savedName);
			}
			setShowPrejoin(false);
		} else {
			// Clear old prejoin data if switching rooms
			sessionStorage.removeItem("prejoin-completed");
			sessionStorage.removeItem("participant-name");
			sessionStorage.removeItem("prejoin-audio-enabled");
			sessionStorage.removeItem("prejoin-video-enabled");
			sessionStorage.removeItem("prejoin-audio-device");
			sessionStorage.removeItem("prejoin-video-device");
		}

		// Store current room name
		sessionStorage.setItem("last-room-name", roomName);
	}, [roomName]);

	const handleJoin = (choices: LocalUserChoices) => {
		// Store prejoin choices in session storage
		sessionStorage.setItem("prejoin-completed", "true");
		sessionStorage.setItem("participant-name", choices.username);
		sessionStorage.setItem(
			"prejoin-audio-enabled",
			choices.audioEnabled.toString(),
		);
		sessionStorage.setItem(
			"prejoin-video-enabled",
			choices.videoEnabled.toString(),
		);

		if (choices.audioDeviceId) {
			sessionStorage.setItem("prejoin-audio-device", choices.audioDeviceId);
		}
		if (choices.videoDeviceId) {
			sessionStorage.setItem("prejoin-video-device", choices.videoDeviceId);
		}

		// Update state to show room
		setParticipantName(choices.username);
		setShowPrejoin(false);
	};

	const handleLeaveRoom = () => {
		// Clear prejoin flag and reload to show prejoin again
		sessionStorage.removeItem("prejoin-completed");
		sessionStorage.removeItem("participant-name");
		sessionStorage.removeItem("prejoin-audio-enabled");
		sessionStorage.removeItem("prejoin-video-enabled");
		sessionStorage.removeItem("prejoin-audio-device");
		sessionStorage.removeItem("prejoin-video-device");
		window.location.reload();
	};

	if (showPrejoin) {
		return (
			<PrejoinScreen
				roomName={roomName}
				roomExists={roomExists}
				isDirector={isDirector}
				username={username}
				isAuthenticated={isAuthenticated}
				onJoin={handleJoin}
			/>
		);
	}

	return (
		<LiveKitRoom
			serverUrl={serverUrl}
			roomName={roomName}
			participantName={participantName}
			onLeaveRoom={handleLeaveRoom}
		/>
	);
}

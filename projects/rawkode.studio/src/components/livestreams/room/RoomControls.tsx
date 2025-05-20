import { Button } from "@/components/shadcn/button";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import {
	LogOut,
	Mic,
	MicOff,
	ScreenShare,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useState } from "react";

// Room Controls Component
export function RoomControls() {
	const { localParticipant } = useLocalParticipant();
	const room = useRoomContext();
	const [permissionsLoaded, setPermissionsLoaded] = useState(false);

	// Default permissions to true initially to show controls while loading
	// This prevents UI flickering and delay
	const [permissions, setPermissions] = useState({
		canPublish: true,
		canPublishData: true,
	});

	// Separate effect to handle permissions loading
	useEffect(() => {
		const checkPermissions = () => {
			if (!room || !room.localParticipant) return;

			const perms = room.localParticipant.permissions;
			setPermissions({
				canPublish: !!perms?.canPublish,
				canPublishData: !!perms?.canPublishData,
			});
			setPermissionsLoaded(true);
		};

		// Check permissions immediately
		checkPermissions();

		// And also when connection state changes
		if (room) {
			room.on("connectionStateChanged", checkPermissions);

			return () => {
				room.off("connectionStateChanged", checkPermissions);
			};
		}
	}, [room]);

	// Count available buttons to determine layout
	const availableButtons = [
		permissions.canPublish, // Audio and video require canPublish
		permissions.canPublish,
		permissions.canPublish && permissions.canPublishData, // Screen sharing requires both
		true, // Leave button is always shown
	].filter(Boolean).length;

	const toggleMicrophone = async () => {
		if (!localParticipant) return;

		try {
			const newState = !localParticipant.isMicrophoneEnabled;
			await localParticipant.setMicrophoneEnabled(newState);
		} catch (error) {
			console.error("Error toggling microphone:", error);
		}
	};

	const toggleCamera = async () => {
		if (!localParticipant) return;

		try {
			const newState = !localParticipant.isCameraEnabled;
			await localParticipant.setCameraEnabled(newState);
		} catch (error) {
			console.error("Error toggling camera:", error);
		}
	};

	const toggleScreenShare = async () => {
		if (!localParticipant) return;

		try {
			const newState = !localParticipant.isScreenShareEnabled;
			await localParticipant.setScreenShareEnabled(newState);
		} catch (error) {
			console.error("Error toggling screen share:", error);
		}
	};

	return (
		<div className="mb-4">
			<h4 className="text-sm font-medium mb-3">Controls</h4>
			<div
				className={`grid ${
					availableButtons === 1 ? "grid-cols-1" : "grid-cols-2"
				} gap-2`}
			>
				{permissions.canPublish && (
					<Button
						size="sm"
						variant={
							localParticipant?.isMicrophoneEnabled ? "default" : "secondary"
						}
						className="flex items-center justify-center h-10 rounded-lg border border-sidebar-border/30 w-full"
						onClick={toggleMicrophone}
						disabled={!permissionsLoaded}
					>
						{localParticipant?.isMicrophoneEnabled ? (
							<Mic className="h-4 w-4 mr-2" />
						) : (
							<MicOff className="h-4 w-4 mr-2" />
						)}
						{localParticipant?.isMicrophoneEnabled ? "Mute" : "Unmute"}
					</Button>
				)}

				{permissions.canPublish && (
					<Button
						size="sm"
						variant={
							localParticipant?.isCameraEnabled ? "default" : "secondary"
						}
						className="flex items-center justify-center h-10 rounded-lg border border-sidebar-border/30 w-full"
						onClick={toggleCamera}
						disabled={!permissionsLoaded}
					>
						{localParticipant?.isCameraEnabled ? (
							<Video className="h-4 w-4 mr-2" />
						) : (
							<VideoOff className="h-4 w-4 mr-2" />
						)}
						{localParticipant?.isCameraEnabled ? "Stop Video" : "Start Video"}
					</Button>
				)}

				{permissions.canPublish && permissions.canPublishData && (
					<Button
						size="sm"
						variant={
							localParticipant?.isScreenShareEnabled ? "default" : "secondary"
						}
						className="flex items-center justify-center h-10 rounded-lg border border-sidebar-border/30 w-full"
						onClick={toggleScreenShare}
						disabled={!permissionsLoaded}
					>
						<ScreenShare className="h-4 w-4 mr-2" />
						{localParticipant?.isScreenShareEnabled
							? "Stop Sharing"
							: "Share Screen"}
					</Button>
				)}

				<Button
					size="sm"
					variant="destructive"
					className="flex items-center justify-center h-10 rounded-lg w-full"
					onClick={() =>
						document.dispatchEvent(new Event("livekit-leave-room"))
					}
				>
					<LogOut className="h-4 w-4 mr-2" />
					Leave
				</Button>
			</div>
		</div>
	);
}

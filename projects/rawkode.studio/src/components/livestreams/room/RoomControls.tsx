import { BackstageToggle } from "@/components/livestreams/room/BackstageToggle";
import { RaiseHandButton } from "@/components/livestreams/room/RaiseHandButton";
import { Button } from "@/components/shadcn/button";
import { useLocalParticipant } from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";
import {
	LogOut,
	Mic,
	MicOff,
	ScreenShare,
	Video,
	VideoOff,
} from "lucide-react";
import { useEffect, useState } from "react";

interface RoomControlsProps {
	token: string | null;
}

// Room Controls Component
export function RoomControls({ token }: RoomControlsProps) {
	const { localParticipant } = useLocalParticipant();
	const [permissionsLoaded, setPermissionsLoaded] = useState(false);

	// Default permissions to true initially to show controls while loading
	// This prevents UI flickering and delay
	const [permissions, setPermissions] = useState({
		canPublish: true,
		canPublishData: true,
	});

	// Update permissions when they change
	useEffect(() => {
		if (!localParticipant) return;

		const updatePermissions = () => {
			const perms = localParticipant.permissions;
			console.log("RoomControls: Updating permissions", perms);
			setPermissions({
				canPublish: !!perms?.canPublish,
				canPublishData: !!perms?.canPublishData,
			});
			setPermissionsLoaded(true);
		};

		// Initial update
		updatePermissions();

		// Listen for permission changes
		const handlePermissionsChanged = () => {
			console.log("RoomControls: Permission change event received");
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
		<div>
			<h4 className="text-sm font-medium mb-3">Controls</h4>

			{/* For viewers - show raise hand above leave button */}
			{!permissions.canPublish && (
				<div className="space-y-2">
					<RaiseHandButton className="h-10 w-full" token={token} />
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
			)}

			<div className="grid grid-cols-2 gap-2">
				{/* For speakers - show all controls */}
				{permissions.canPublish && (
					<>
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

						{permissions.canPublishData && (
							<Button
								size="sm"
								variant={
									localParticipant?.isScreenShareEnabled
										? "default"
										: "secondary"
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
					</>
				)}
			</div>

			{/* Show additional controls below the grid */}
			{permissions.canPublish &&
				localParticipant?.attributes?.role === "director" && (
					<div className="mt-2">
						<BackstageToggle />
					</div>
				)}
		</div>
	);
}

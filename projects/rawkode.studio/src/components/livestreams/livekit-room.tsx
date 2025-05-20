import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import { Skeleton } from "@/components/shadcn/skeleton";
import { cn } from "@/lib/utils";
import {
	LayoutContextProvider,
	LiveKitRoom,
	RoomAudioRenderer,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { useEffect, useState } from "react";
import { Chat } from "./room/Chat";
import { ConnectionIndicator } from "./room/ConnectionIndicator";
import { ParticipantsList } from "./room/ParticipantsList";
import { RoomControls } from "./room/RoomControls";
import { VideoGrid } from "./room/VideoGrid";

// Define props interface
export interface LivekitRoomProps {
	serverUrl: string;
	onLeaveRoom?: (roomName: string) => void;
	className?: string;
}

export default function LivekitRoomWrapper({
	serverUrl,
	onLeaveRoom,
	className,
}: LivekitRoomProps) {
	const [token, setToken] = useState<string | null>(null);
	const [roomName, setRoomName] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [connectionStatus, setConnectionStatus] =
		useState<string>("connecting");

	// Get tokens from sessionStorage
	useEffect(() => {
		const refreshFromSessionStorage = () => {
			try {
				const fetchedToken = sessionStorage.getItem("livekit-token");
				const fetchedRoom = sessionStorage.getItem("livekit-room");

				if (fetchedToken && fetchedRoom) {
					setToken(fetchedToken);
					setRoomName(fetchedRoom);
				}
			} catch (err) {
				setError("Failed to load session data");
			}
		};

		refreshFromSessionStorage();

		// Set up an interval to check for token updates
		const intervalId = setInterval(refreshFromSessionStorage, 1000);

		return () => clearInterval(intervalId);
	}, []);

	// Listen for refresh tokens event
	useEffect(() => {
		const refreshTokens = () => {
			try {
				const fetchedToken = sessionStorage.getItem("livekit-token");
				const fetchedRoom = sessionStorage.getItem("livekit-room");

				if (fetchedToken && fetchedRoom) {
					setToken(fetchedToken);
					setRoomName(fetchedRoom);
				}
			} catch (err) {
				setError("Failed to update session data");
			}
		};

		document.addEventListener("livekit-refresh-tokens", refreshTokens);

		return () => {
			document.removeEventListener("livekit-refresh-tokens", refreshTokens);
		};
	}, []);

	// Listen for leave room event
	useEffect(() => {
		const leaveRoomHandler = () => {
			if (roomName) handleLeaveRoom(roomName);
		};

		document.addEventListener("livekit-leave-room", leaveRoomHandler);

		return () => {
			document.removeEventListener("livekit-leave-room", leaveRoomHandler);
		};
	}, [roomName]);

	// Handle browser permissions errors
	useEffect(() => {
		const handlePermissionError = (e: ErrorEvent) => {
			if (
				e.message &&
				(e.message.includes("Permission denied") ||
					e.message.includes("NotAllowedError") ||
					e.message.includes("NotFoundError"))
			) {
				setError(
					"Media permission denied. Please allow camera/microphone access in your browser settings.",
				);
			}
		};

		window.addEventListener("error", handlePermissionError);
		return () => window.removeEventListener("error", handlePermissionError);
	}, []);

	// Handle room leave/disconnect with fallback if callback is not provided
	const handleLeaveRoom = (name: string) => {
		try {
			// Clear tokens
			sessionStorage.removeItem("livekit-token");
			sessionStorage.removeItem("livekit-room");
			setConnectionStatus("disconnected");

			// Call the callback if it exists and is a function
			if (typeof onLeaveRoom === "function") {
				onLeaveRoom(name);
			} else {
				// Fallback: redirect to invite page
				if (name) {
					window.location.href = `/invite/${name}`;
				}
			}
		} catch (err) {
			// Still try to redirect even if there was an error
			if (name) {
				window.location.href = `/invite/${name}`;
			}
		}
	};

	// Show an error message if we encountered a problem
	if (error) {
		return (
			<div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-background/95">
				<div className="max-w-md w-full">
					<div className="mb-4 p-4 border border-destructive bg-destructive/10 text-destructive rounded-md">
						<h3 className="font-semibold">Connection Error</h3>
						<p className="text-sm">{error}</p>
					</div>
					<Button
						className="w-full py-2 px-4"
						onClick={() => {
							setError(null);
							window.location.reload();
						}}
					>
						Try Again
					</Button>
				</div>
			</div>
		);
	}

	if (!token || !roomName) {
		return null;
	}

	return (
		<LiveKitRoom
			token={token}
			serverUrl={serverUrl}
			connect={true}
			video={false}
			audio={false}
			onDisconnected={() => {
				setConnectionStatus("disconnected");
				if (roomName) handleLeaveRoom(roomName);
			}}
			onConnected={() => {
				setConnectionStatus("connected");
				document.dispatchEvent(new CustomEvent("livekit-refresh-tokens"));
			}}
			onError={(err) => {
				setConnectionStatus("error");

				// Handle specific error cases
				if (
					err.message.includes("room not found") ||
					err.message.includes("room does not exist") ||
					err.message.includes("not found") ||
					err.message.includes("404")
				) {
					setError(
						`Room "${roomName}" doesn't exist. You cannot create rooms by joining them.`,
					);
				} else if (err.message.includes("permission")) {
					setError(`You don't have permission to join room "${roomName}".`);
				} else if (err.message.includes("token")) {
					setError(
						"Invalid or expired token. Please request a new invitation.",
					);
				} else {
					setError(`Connection error: ${err.message}`);
				}
			}}
			className={cn("relative fixed inset-0 bg-background z-20", className)}
		>
			<LayoutContextProvider>
				<div className="fixed inset-0 flex">
					{/* Main video grid area */}
					<div className="flex-1 h-full overflow-hidden">
						<VideoGrid />
					</div>

					{/* Right sidebar */}
					<div
						className={cn(
							"w-80 h-full bg-sidebar/90 backdrop-blur-md border-l border-sidebar-border/50 flex flex-col overflow-hidden",
							connectionStatus !== "connected" &&
								"pointer-events-none opacity-90",
						)}
					>
						<div className="p-3 border-b border-sidebar-border/50 space-y-2">
							<div className="text-center font-bold text-sidebar-foreground">
								{roomName}
							</div>
							<ConnectionIndicator status={connectionStatus} />
						</div>

						<div className="flex-1 overflow-y-auto p-3 space-y-4 flex flex-col">
							{connectionStatus === "connected" ? (
								<>
									<RoomControls />
									<Separator />
									<div className="flex-1 grid grid-rows-2 gap-4 min-h-0">
										<ParticipantsList />
										<Chat token={token} />
									</div>
								</>
							) : (
								<>
									{/* Skeleton UI while connecting */}
									<div className="mb-4">
										<Skeleton className="h-6 w-24 mb-3" />
										<div className="grid grid-cols-2 gap-2">
											<Skeleton className="h-10 w-full" />
											<Skeleton className="h-10 w-full" />
											<Skeleton className="h-10 w-full" />
											<Skeleton className="h-10 w-full" />
										</div>
									</div>
									<Separator />
									<div className="flex-1 grid grid-rows-2 gap-4 min-h-0">
										{/* Participants list skeleton */}
										<div className="flex flex-col h-full min-h-0">
											<Skeleton className="h-6 w-32 mb-3" />
											<div className="flex-1 space-y-2">
												<Skeleton className="h-12 w-full" />
												<Skeleton className="h-12 w-full" />
												<Skeleton className="h-12 w-full" />
											</div>
										</div>

										{/* Chat skeleton */}
										<div className="flex flex-col h-full min-h-0">
											<Skeleton className="h-6 w-16 mb-3" />
											<Skeleton className="flex-1 w-full mb-3" />
											<div className="flex gap-2">
												<Skeleton className="h-9 flex-1" />
												<Skeleton className="h-9 w-16" />
											</div>
										</div>
									</div>
								</>
							)}
						</div>

						<div className="p-2 border-t border-sidebar-border/50">
							{/* Footer content if needed */}
						</div>
					</div>
				</div>
				<RoomAudioRenderer />
			</LayoutContextProvider>
		</LiveKitRoom>
	);
}

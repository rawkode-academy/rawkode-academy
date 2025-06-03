import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import {
	useLocalParticipant,
	useParticipants,
	useRoomContext,
} from "@livekit/components-react";
import {
	Mic,
	MoreVertical,
	UserCheck,
	UserMinus,
	Users,
	Video,
} from "lucide-react";
import { useMemo, useState } from "react";

interface ParticipantsListProps {
	token: string | null;
}

// Participants List Component
export function ParticipantsList({ token }: ParticipantsListProps) {
	const participants = useParticipants();
	const { localParticipant } = useLocalParticipant();
	const room = useRoomContext();
	const [loadingParticipant, setLoadingParticipant] = useState<string | null>(
		null,
	);

	// Check if current user is a director
	const isCurrentUserDirector =
		localParticipant?.attributes?.role === "director";

	const handlePromote = async (participantIdentity: string) => {
		if (!room?.name) return;
		setLoadingParticipant(participantIdentity);

		try {
			const response = await fetch("/api/livestream/participant", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token && { Authorization: `Bearer ${token}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					roomName: room.name,
					participantIdentity,
					action: "promote",
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				console.error("Failed to promote participant:", error);
			}
		} catch (error) {
			console.error("Failed to promote participant:", error);
		} finally {
			setLoadingParticipant(null);
		}
	};

	const handleDemote = async (participantIdentity: string) => {
		if (!room?.name) return;
		setLoadingParticipant(participantIdentity);

		try {
			const response = await fetch("/api/livestream/participant", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token && { Authorization: `Bearer ${token}` }),
				},
				credentials: "include",
				body: JSON.stringify({
					roomName: room.name,
					participantIdentity,
					action: "demote",
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				console.error("Failed to demote participant:", error);
			}
		} catch (error) {
			console.error("Failed to demote participant:", error);
		} finally {
			setLoadingParticipant(null);
		}
	};

	// Sort participants: speakers first, then viewers, alphabetically within each group
	const sortedParticipants = useMemo(() => {
		return [...participants].sort((a, b) => {
			const aIsDirector = a.attributes?.role === "director";
			const bIsDirector = b.attributes?.role === "director";
			const aCanPublish = a.permissions?.canPublish || aIsDirector;
			const bCanPublish = b.permissions?.canPublish || bIsDirector;

			// Sort by speaking ability first
			if (aCanPublish && !bCanPublish) return -1;
			if (!aCanPublish && bCanPublish) return 1;

			// Within same group, sort by name
			return (a.name || a.identity).localeCompare(b.name || b.identity);
		});
	}, [participants]);

	return (
		<div className="flex flex-col h-full min-h-0">
			<h4 className="text-sm font-medium mb-3 flex items-center flex-shrink-0">
				<Users className="h-4 w-4 mr-2" />
				Participants ({participants.length})
			</h4>
			<div
				className="flex-1 overflow-y-auto pr-1 space-y-1 min-h-0"
				style={{ scrollbarWidth: "thin" }}
			>
				{sortedParticipants.map((participant) => {
					const isDirector = participant.attributes?.role === "director";
					const canPublish = participant.permissions?.canPublish || isDirector;
					const isLoading = loadingParticipant === participant.identity;

					return (
						<div
							key={participant.identity}
							className={`
								flex items-center p-2.5 rounded-lg transition-colors
								${
									canPublish
										? "bg-sidebar-accent/40 border border-sidebar-border/30"
										: "bg-sidebar-accent/20 border border-sidebar-border/10"
								}
								${isLoading ? "opacity-50" : ""}
							`}
						>
							<Avatar className="h-7 w-7 mr-2.5 flex-shrink-0">
								<AvatarFallback
									className={`text-xs ${canPublish ? "bg-primary/20" : ""}`}
								>
									{participant.identity.slice(0, 2).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<span
									className={`text-sm truncate ${canPublish ? "font-medium" : ""}`}
								>
									{participant.name || participant.identity}
								</span>
							</div>
							{/* Show media indicators and speaker badge */}
							<div className="flex items-center gap-2 flex-shrink-0 ml-2">
								{canPublish && (
									<>
										{participant.isMicrophoneEnabled && (
											<Mic className="h-3.5 w-3.5 text-green-500" />
										)}
										{participant.isCameraEnabled && (
											<Video className="h-3.5 w-3.5 text-blue-500" />
										)}
										<span className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-medium">
											SPEAKER
										</span>
									</>
								)}

								{/* Show menu for directors to manage other participants */}
								{isCurrentUserDirector && !isDirector && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-6 w-6 p-0"
												disabled={isLoading}
											>
												<MoreVertical className="h-3.5 w-3.5" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" className="w-48">
											{!canPublish ? (
												<DropdownMenuItem
													onClick={() => handlePromote(participant.identity)}
													className="text-sm"
												>
													<UserCheck className="h-3.5 w-3.5 mr-2" />
													Promote to Speaker
												</DropdownMenuItem>
											) : (
												<DropdownMenuItem
													onClick={() => handleDemote(participant.identity)}
													className="text-sm"
												>
													<UserMinus className="h-3.5 w-3.5 mr-2" />
													Demote to Viewer
												</DropdownMenuItem>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						</div>
					);
				})}
				{participants.length === 0 && (
					<div className="text-xs text-sidebar-foreground/50 text-center py-2">
						No participants yet
					</div>
				)}
			</div>
		</div>
	);
}

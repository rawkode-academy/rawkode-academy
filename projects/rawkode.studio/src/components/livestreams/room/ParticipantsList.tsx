import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { useParticipants } from "@livekit/components-react";
import { Mic, MicOff, Users, Video, VideoOff } from "lucide-react";

// Participants List Component
export function ParticipantsList() {
	const participants = useParticipants();

	return (
		<div className="flex flex-col h-full min-h-0">
			<h4 className="text-sm font-medium mb-3 flex items-center flex-shrink-0">
				<Users className="h-4 w-4 mr-2" />
				Participants ({participants.length})
			</h4>
			<div
				className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0"
				style={{ scrollbarWidth: "thin" }}
			>
				{participants.map((participant) => (
					<div
						key={participant.identity}
						className="flex items-center p-2 rounded-md bg-sidebar-accent/30 border border-sidebar-border/20"
					>
						<Avatar className="h-6 w-6 mr-2 flex-shrink-0">
							<AvatarFallback>
								{participant.identity.slice(0, 2).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 text-sm truncate">
							{participant.name || participant.identity}
						</div>
						<div className="flex items-center gap-1 flex-shrink-0">
							{participant.isMicrophoneEnabled ? (
								<Mic className="h-3 w-3" />
							) : (
								<MicOff className="h-3 w-3 text-sidebar-foreground/50" />
							)}
							{participant.isCameraEnabled ? (
								<Video className="h-3 w-3" />
							) : (
								<VideoOff className="h-3 w-3 text-sidebar-foreground/50" />
							)}
						</div>
					</div>
				))}
				{participants.length === 0 && (
					<div className="text-xs text-sidebar-foreground/50 text-center py-2">
						No participants yet
					</div>
				)}
			</div>
		</div>
	);
}

import { Button } from "@/components/shadcn/button";
import {
	useLocalParticipant,
	useParticipants,
	useRoomContext,
} from "@livekit/components-react";
import { CheckCircle, Hand, XCircle } from "lucide-react";
import { useMemo } from "react";

interface RaisedHandsListProps {
	token: string | null;
}

export function RaisedHandsList({ token }: RaisedHandsListProps) {
	const { localParticipant } = useLocalParticipant();
	const room = useRoomContext();
	const participants = useParticipants();

	// Get raised hands from participant attributes
	const raisedHands = useMemo(() => {
		return participants.filter(
			(p) =>
				!p.permissions?.canPublish && // Only viewers
				p.attributes?.raisedHand === "true",
		);
	}, [participants]);

	const handlePromote = async (participantIdentity: string) => {
		if (!room?.name) return;

		try {
			// Call API to update participant permissions
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
		}
	};

	const handleReject = async (participantIdentity: string) => {
		if (!room?.name) return;

		try {
			// Update participant's attribute to lower their hand
			const participant = participants.find(
				(p) => p.identity === participantIdentity,
			);
			if (participant) {
				// For now, we'll use the API to ensure it's done server-side
				const response = await fetch("/api/livestream/participant", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(token && { Authorization: `Bearer ${token}` }),
					},
					credentials: "include",
					body: JSON.stringify({
						roomName: room.name,
						action: "lower_hand",
					}),
				});

				if (!response.ok) {
					const error = await response.json();
					console.error("Failed to lower hand:", error);
				}
			}
		} catch (error) {
			console.error("Failed to reject hand raise:", error);
		}
	};

	// Only show for hosts (those who can publish)
	if (!localParticipant?.permissions?.canPublish) {
		return null;
	}

	if (raisedHands.length === 0) {
		return null;
	}

	return (
		<div className="space-y-3">
			<h4 className="text-sm font-medium flex items-center gap-2">
				<Hand className="h-4 w-4 text-orange-500 animate-pulse" />
				Speaking Requests ({raisedHands.length})
			</h4>
			<div className="space-y-2">
				{raisedHands.map((participant) => (
					<div
						key={participant.identity}
						className="flex items-center justify-between p-3 bg-sidebar-accent/30 border border-sidebar-border/20 rounded-lg"
					>
						<span className="text-sm font-medium truncate pr-2">
							{participant.name || participant.identity}
						</span>
						<div className="flex gap-2 flex-shrink-0">
							<Button
								size="sm"
								variant="ghost"
								className="h-8 px-3 hover:bg-green-500/20"
								onClick={() => handlePromote(participant.identity)}
								title="Approve request to speak"
							>
								<CheckCircle className="h-4 w-4 text-green-600 mr-1" />
								<span className="text-xs">Approve</span>
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-8 px-3 hover:bg-destructive/20"
								onClick={() => handleReject(participant.identity)}
								title="Decline request"
							>
								<XCircle className="h-4 w-4 text-destructive mr-1" />
								<span className="text-xs">Decline</span>
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

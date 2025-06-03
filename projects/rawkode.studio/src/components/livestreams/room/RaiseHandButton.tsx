import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Hand } from "lucide-react";
import { useState } from "react";

interface RaiseHandButtonProps {
	className?: string;
	token: string | null;
}

export function RaiseHandButton({ className, token }: RaiseHandButtonProps) {
	const { localParticipant } = useLocalParticipant();
	const room = useRoomContext();
	const [isUpdating, setIsUpdating] = useState(false);

	// Read hand raised state from participant attributes
	const handRaised = localParticipant?.attributes?.raisedHand === "true";

	const toggleHand = async () => {
		if (!localParticipant || !room || isUpdating) return;

		const newHandState = !handRaised;
		setIsUpdating(true);

		try {
			// Try to update directly first (works if we have canUpdateOwnMetadata permission)
			await localParticipant.setAttributes({
				...localParticipant.attributes,
				raisedHand: newHandState.toString(),
				raisedHandTime: newHandState ? Date.now().toString() : "",
			});
		} catch (error) {
			console.log("Direct update failed, using API fallback:", error);

			// Fallback to API endpoint
			try {
				const response = await fetch("/api/livestream/participant", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(token && { Authorization: `Bearer ${token}` }),
					},
					body: JSON.stringify({
						roomName: room.name,
						action: "raise_hand",
						raised: newHandState,
					}),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error("API raise hand failed:", errorData);
				}
			} catch (apiError) {
				console.error("API fallback failed:", apiError);
			}
		} finally {
			setIsUpdating(false);
		}
	};

	// Only show for viewers (those who can't publish)
	if (localParticipant?.permissions?.canPublish) {
		return null;
	}

	return (
		<Button
			variant={handRaised ? "default" : "outline"}
			size="sm"
			onClick={toggleHand}
			disabled={isUpdating}
			className={cn("gap-2", className)}
			title={
				handRaised
					? "Cancel your request to speak"
					: "Request to join the stage"
			}
		>
			<Hand className={`size-4 ${handRaised ? "animate-pulse" : ""}`} />
			{isUpdating
				? "Updating..."
				: handRaised
					? "Cancel Request"
					: "Request to Speak"}
		</Button>
	);
}

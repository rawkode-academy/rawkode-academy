import { RaiseHandContext } from "@/components/livestreams/room/controls/RaiseHandContext";
import { Button } from "@/components/shadcn/button";
import {
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import type { RemoteParticipant } from "livekit-client";
import { Check, X } from "lucide-react";
import { useContext, useState } from "react";

interface RaisedHandsListProps {
  onPromote: (participantIdentity: string) => Promise<void>;
  token: string | null;
}

export function RaisedHandsList({ onPromote, token }: RaisedHandsListProps) {
  const [processingParticipant, setProcessingParticipant] = useState<
    string | null
  >(null);
  const room = useRoomContext();
  const remoteParticipants = useRemoteParticipants();
  const { raisedHands } = useContext(RaiseHandContext);

  // Get participants with raised hands
  const raisedHandParticipants = remoteParticipants.filter((participant) =>
    raisedHands.has(participant.identity),
  );

  if (raisedHandParticipants.length === 0) {
    return null;
  }

  const handleApprove = async (participant: RemoteParticipant) => {
    setProcessingParticipant(participant.identity);
    try {
      // Promote to speaker (raised hand will be cleared server-side)
      await onPromote(participant.identity);
    } catch (error) {
      console.error("Failed to approve participant:", error);
    } finally {
      setProcessingParticipant(null);
    }
  };

  const handleDecline = async (participant: RemoteParticipant) => {
    setProcessingParticipant(participant.identity);
    try {
      // Send response via data message
      const response = await fetch("/api/livestream/participant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        credentials: "include",
        body: JSON.stringify({
          roomName: room?.name,
          participantIdentity: participant.identity,
          targetIdentity: participant.identity,
          approved: false,
          action: "raise_hand_response",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to decline raised hand:", error);
      }
    } catch (error) {
      console.error("Failed to decline raised hand:", error);
    } finally {
      setProcessingParticipant(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="mb-2">
        <h5 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Raised Hands ({raisedHandParticipants.length})
        </h5>
      </div>

      <div className="space-y-2">
        {raisedHandParticipants.map((participant) => {
          const isProcessing = processingParticipant === participant.identity;

          return (
            <div
              key={participant.identity}
              className="flex items-center gap-2 p-2 bg-orange-500/10 dark:bg-orange-500/10 border border-orange-500/30 dark:border-orange-500/20 rounded-xl"
            >
              <span className="flex-1 text-sm font-medium text-foreground truncate">
                {participant.name || participant.identity}
              </span>

              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApprove(participant)}
                  disabled={isProcessing}
                  className="h-7 w-7 p-0 border-green-500/50 text-green-600 hover:bg-green-500/20 hover:text-green-700 hover:border-green-500 dark:border-green-500/30 dark:text-green-400 dark:hover:text-green-300 dark:hover:border-green-400 rounded-lg transition-colors"
                  title="Approve and promote to speaker"
                >
                  <Check className="h-3 w-3" />
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(participant)}
                  disabled={isProcessing}
                  className="h-7 w-7 p-0 border-red-500/50 text-red-600 hover:bg-red-500/20 hover:text-red-700 hover:border-red-500 dark:border-red-500/30 dark:text-red-400 dark:hover:text-red-300 dark:hover:border-red-400 rounded-lg transition-colors"
                  title="Decline request"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

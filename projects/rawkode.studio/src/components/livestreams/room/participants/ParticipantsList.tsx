import { useRoomPermissions } from "@/components/livestreams/room/hooks/useRoomPermissions";
import { parseRoomMetadata } from "@/components/livestreams/room/layouts/permissions";
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
  useRoomInfo,
} from "@livekit/components-react";
import {
  Mic,
  MicOff,
  MoreVertical,
  Presentation,
  UserCheck,
  UserMinus,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface ParticipantsListProps {
  token: string | null;
}

// Participants List Component
export function ParticipantsList({ token }: ParticipantsListProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const roomInfo = useRoomInfo();
  const permissions = useRoomPermissions();
  const [loadingParticipant, setLoadingParticipant] = useState<string | null>(
    null,
  );
  const [currentPresenter, setCurrentPresenter] = useState<
    string | undefined
  >();

  // Listen for room metadata changes to track presenter
  useEffect(() => {
    if (!roomInfo?.metadata) return;
    const metadata = parseRoomMetadata(roomInfo.metadata);
    if (metadata?.presenter) {
      setCurrentPresenter(metadata.presenter);
    }
  }, [roomInfo?.metadata]);

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

  // Categorize participants
  const { speakers, viewers } = useMemo(() => {
    const speakers: typeof participants = [];
    const viewers: typeof participants = [];

    for (const participant of participants) {
      // Categorize based on publish permission
      if (participant.permissions?.canPublish) {
        speakers.push(participant);
      } else {
        viewers.push(participant);
      }
    }

    return { speakers, viewers };
  }, [participants]);

  const renderParticipant = (participant: (typeof participants)[0]) => {
    const isLocal = participant === localParticipant;
    const isSpeaker = participant.permissions?.canPublish;
    const participantRole = participant.attributes?.role || "viewer";
    const isDirector = participantRole === "director";
    const isLoading = loadingParticipant === participant.identity;
    const isPresenter = participant.identity === currentPresenter;
    const isViewer = participantRole === "viewer";

    return (
      <div
        key={participant.identity}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
          isSpeaker
            ? "bg-muted/50 border border-border"
            : "bg-muted/30 border border-border/50 hover:bg-muted/50"
        }`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">
            {participant.attributes?.displayName || participant.identity}
          </p>

          <div className="flex items-center gap-2 ml-auto">
            {isSpeaker && (
              <>
                {participant.isMicrophoneEnabled ? (
                  <Mic className="h-3 w-3 text-green-400" />
                ) : (
                  <MicOff className="h-3 w-3 text-muted-foreground" />
                )}
                {participant.isCameraEnabled ? (
                  <Video className="h-3 w-3 text-blue-400" />
                ) : (
                  <VideoOff className="h-3 w-3 text-muted-foreground" />
                )}
              </>
            )}
            {isPresenter && (
              <span title="Presenter">
                <Presentation className="h-3 w-3 text-amber-400" />
              </span>
            )}
          </div>
        </div>

        {(permissions.canPromoteParticipants ||
          permissions.canDemoteParticipants) &&
          !isLocal &&
          !isDirector &&
          ((!isSpeaker && !isViewer) || isSpeaker) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-accent"
                  disabled={isLoading}
                >
                  <MoreVertical className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!isSpeaker &&
                  permissions.canPromoteParticipants &&
                  !isViewer && (
                    <DropdownMenuItem
                      onClick={() => handlePromote(participant.identity)}
                      disabled={isLoading}
                      className="cursor-pointer"
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Promote to Speaker
                    </DropdownMenuItem>
                  )}
                {isSpeaker && permissions.canDemoteParticipants && (
                  <DropdownMenuItem
                    onClick={() => handleDemote(participant.identity)}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Demote to Viewer
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {speakers.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Speakers ({speakers.length})
          </h5>
          <div className="space-y-2">{speakers.map(renderParticipant)}</div>
        </div>
      )}

      {viewers.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Viewers ({viewers.length})
          </h5>
          <div className="space-y-2">{viewers.map(renderParticipant)}</div>
        </div>
      )}

      {participants.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No participants yet</p>
        </div>
      )}
    </div>
  );
}

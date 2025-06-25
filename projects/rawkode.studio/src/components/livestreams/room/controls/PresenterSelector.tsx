import { actions } from "astro:actions";
import {
  useLocalParticipant,
  useParticipants,
  useRoomInfo,
} from "@livekit/components-react";
import { Presentation, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRoomPermissions } from "@/components/livestreams/room/hooks/useRoomPermissions";
import {
  LayoutType,
  parseRoomMetadata,
  stringifyRoomMetadata,
} from "@/components/livestreams/room/layouts/permissions";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";

export function PresenterSelector() {
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();
  const roomInfo = useRoomInfo();
  const permissions = useRoomPermissions();
  const [currentPresenter, setCurrentPresenter] = useState<
    string | undefined
  >();
  const [isUpdating, setIsUpdating] = useState(false);

  // Get eligible participants (those with publish rights)
  const eligibleParticipants = participants.filter((p) => {
    // Check if participant has publish permissions
    return p.permissions?.canPublish;
  });

  // Listen for room metadata changes
  useEffect(() => {
    if (!roomInfo?.metadata) return;

    const metadata = parseRoomMetadata(roomInfo.metadata);
    if (metadata?.presenter) {
      setCurrentPresenter(metadata.presenter);
    }
  }, [roomInfo?.metadata]);

  // The first director to join is automatically set as presenter
  // in the token generation endpoint, so we don't need to handle it here

  const handleSetPresenter = useCallback(
    async (participantIdentity: string) => {
      if (!permissions.canSelectPresenter || !roomInfo?.name) {
        toast.error("You don't have permission to change the presenter");
        return;
      }

      setIsUpdating(true);

      try {
        const existingMetadata = parseRoomMetadata(roomInfo.metadata) || {
          activeLayout: LayoutType.GRID,
        };

        const metadata = {
          ...existingMetadata,
          presenter: participantIdentity,
        };

        const result = await actions.rooms.updateRoomLayout({
          roomId: roomInfo.name,
          metadata: stringifyRoomMetadata(metadata),
        });

        if (result.error) {
          throw new Error(result.error.message || "Failed to update presenter");
        }

        const participant = participants.find(
          (p) => p.identity === participantIdentity,
        );
        const name = participant?.name || participant?.identity || "Unknown";
        toast.success(`${name} is now the presenter`);
      } catch (error) {
        console.error("Failed to update presenter:", error);
        toast.error("Failed to change presenter");
      } finally {
        setIsUpdating(false);
      }
    },
    [
      permissions.canSelectPresenter,
      roomInfo?.name,
      roomInfo?.metadata,
      participants,
    ],
  );

  const currentPresenterParticipant = participants.find(
    (p) => p.identity === currentPresenter,
  );

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                disabled={
                  !permissions.canSelectPresenter ||
                  eligibleParticipants.length === 0 ||
                  isUpdating
                }
                className="h-9 w-full rounded-md transition-all hover:scale-105"
              >
                <Presentation className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {!permissions.canSelectPresenter
                ? "You don't have permission to change presenter"
                : eligibleParticipants.length === 0
                  ? "No eligible participants"
                  : "Change presenter"}
            </p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Select Presenter</DropdownMenuLabel>
          {currentPresenterParticipant && (
            <>
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                Current:{" "}
                {currentPresenterParticipant.name ||
                  currentPresenterParticipant.identity}
              </div>
              <DropdownMenuSeparator />
            </>
          )}

          {eligibleParticipants.map((participant) => {
            const isCurrentPresenter =
              participant.identity === currentPresenter;
            const isYou = participant.identity === localParticipant?.identity;

            return (
              <DropdownMenuItem
                key={participant.identity}
                onClick={() => handleSetPresenter(participant.identity)}
                disabled={isCurrentPresenter || isUpdating}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <User
                    className={`h-4 w-4 ${
                      isCurrentPresenter
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  />
                  <div className="flex-1">
                    <div
                      className={`font-medium ${
                        isCurrentPresenter ? "text-primary" : ""
                      }`}
                    >
                      {participant.name || participant.identity}
                      {isYou && " (You)"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {participant.attributes?.role || "Participant"}
                    </div>
                  </div>
                  {isCurrentPresenter && (
                    <div className="text-xs text-primary font-medium">
                      Presenter
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}

          {eligibleParticipants.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No eligible participants
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

import { actions } from "astro:actions";
import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import {
  Grid3x3,
  LayoutGrid,
  MessageSquare,
  PictureInPicture,
  Presentation,
  User,
  Users,
  Users2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useLayout } from "@/components/livestreams/room/core/LayoutContext";
import {
  getUserRole,
  LAYOUT_CONFIGS,
  type LayoutType,
  parseRoomMetadata,
  ROLE_PERMISSIONS,
  type RoomLayoutMetadata,
  stringifyRoomMetadata,
} from "@/components/livestreams/room/layouts/permissions";
import { layoutRegistry } from "@/lib/layout";
import { getParticipantRole } from "@/lib/participant";
// Import layouts to ensure they're registered
import "@/components/livestreams/room/layouts";
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

const LAYOUT_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  User,
  Users,
  PictureInPicture,
  Grid3x3,
  Presentation,
  MessageSquare,
  Users2,
};

interface LayoutSelectorProps {
  token: string | null;
}

export function LayoutSelector({ token }: LayoutSelectorProps) {
  const { localParticipant } = useLocalParticipant();
  const roomInfo = useRoomInfo();
  const { currentLayout, setCurrentLayout } = useLayout();
  const [isUpdating, setIsUpdating] = useState(false);

  // Check if user has permission to change layouts using the permission system
  const participantRole = getParticipantRole(localParticipant);
  const isDirector = participantRole === "director";
  // Check if the local participant is the presenter by comparing with room metadata
  const roomPresenter = parseRoomMetadata(roomInfo?.metadata)?.presenter;
  const isPresenter = localParticipant?.identity === roomPresenter;
  const role = getUserRole(isDirector, isPresenter, participantRole);
  const canChangeLayout = ROLE_PERMISSIONS[role].canSelectLayout;

  // Listen for room metadata changes
  useEffect(() => {
    if (!roomInfo?.metadata) return;

    const metadata = parseRoomMetadata(roomInfo.metadata);
    if (metadata?.layout && metadata.layout !== currentLayout) {
      setCurrentLayout(metadata.layout as LayoutType);
    }
  }, [roomInfo?.metadata, currentLayout, setCurrentLayout]);

  const handleLayoutChange = useCallback(
    async (newLayout: LayoutType) => {
      if (!canChangeLayout) {
        toast.error("Only directors and the presenter can change layouts");
        return;
      }

      if (newLayout === currentLayout) return;

      setIsUpdating(true);

      try {
        // Preserve existing metadata like presenter and displayName
        const existingMetadata = parseRoomMetadata(roomInfo?.metadata) || {};
        const metadata: RoomLayoutMetadata = {
          ...existingMetadata,
          layout: newLayout,
        };

        // Update room metadata via API endpoint with LiveKit token auth
        const response = await fetch("/api/livestream/layout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: "include",
          body: JSON.stringify({
            roomName: roomInfo?.name || "",
            metadata: stringifyRoomMetadata(metadata),
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update layout");
        }

        toast.success(`Layout changed to ${LAYOUT_CONFIGS[newLayout].name}`);

        // Also update the egress layout if recording is active
        if (roomInfo?.name) {
          try {
            await actions.rooms.updateRoomEgressLayout({
              roomId: roomInfo.name,
              layout: newLayout,
            });
          } catch (egressError) {
            // Don't fail the whole operation if egress update fails
            console.warn("Failed to update egress layout:", egressError);
          }
        }
      } catch (error) {
        console.error("Failed to update layout:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to change layout",
        );
      } finally {
        setIsUpdating(false);
      }
    },
    [canChangeLayout, currentLayout, roomInfo?.name, roomInfo?.metadata, token],
  );

  // Get layouts from the registry
  const availableLayouts = layoutRegistry.getAll();

  const currentConfig = LAYOUT_CONFIGS[currentLayout];
  const IconComponent = LAYOUT_ICONS[currentConfig?.icon] || LayoutGrid;

  return (
    <TooltipProvider>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                disabled={!canChangeLayout || isUpdating}
                className="h-9 w-full rounded-md transition-all hover:scale-105"
              >
                <IconComponent className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {!canChangeLayout
                ? "Only directors and presenters can change layouts"
                : "Change layout"}
            </p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Select Layout</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {availableLayouts.map((layout) => {
            // Get icon from LAYOUT_CONFIGS if available, otherwise use LayoutGrid
            const layoutConfig = LAYOUT_CONFIGS[layout.id as LayoutType];
            const LayoutIcon = layoutConfig
              ? LAYOUT_ICONS[layoutConfig.icon] || LayoutGrid
              : LayoutGrid;
            const isActive = layout.id === currentLayout;

            return (
              <DropdownMenuItem
                key={layout.id}
                onClick={() => handleLayoutChange(layout.id as LayoutType)}
                disabled={isActive || isUpdating}
                className="cursor-pointer"
              >
                <div className="flex items-start gap-3 w-full">
                  <LayoutIcon
                    className={`h-4 w-4 mt-0.5 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="flex-1">
                    <div
                      className={`font-medium ${isActive ? "text-primary" : ""}`}
                    >
                      {layout.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {layout.description}
                    </div>
                  </div>
                  {isActive && (
                    <div className="text-xs text-primary font-medium">
                      Active
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            );
          })}

          {availableLayouts.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No layouts available for current room state
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

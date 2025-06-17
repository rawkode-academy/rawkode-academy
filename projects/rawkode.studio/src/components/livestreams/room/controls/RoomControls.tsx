import { useLocalParticipant, useRoomInfo } from "@livekit/components-react";
import { VideoPresets } from "livekit-client";
import {
  LogOut,
  Mic,
  MicOff,
  ScreenShare,
  ScreenShareOff,
  Video,
  VideoOff,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { SettingsDialog } from "@/components/livestreams/dialogs/SettingsDialog";
import { BackstageToggle } from "@/components/livestreams/room/controls/BackstageToggle";
import { LayoutSelector } from "@/components/livestreams/room/controls/LayoutSelector";
import { PresenterSelector } from "@/components/livestreams/room/controls/PresenterSelector";
import { RaiseHandButton } from "@/components/livestreams/room/controls/RaiseHandButton";
import { useMediaPermissions } from "@/components/livestreams/room/hooks/useMediaPermissions";
import {
  getUserRole,
  parseRoomMetadata,
  ROLE_PERMISSIONS,
} from "@/components/livestreams/room/layouts/permissions";
import { Button } from "@/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";

interface RoomControlsProps {
  token: string | null;
}

// Room Controls Component
export function RoomControls({ token }: RoomControlsProps) {
  const { localParticipant } = useLocalParticipant();
  const roomInfo = useRoomInfo();
  const { canPublish, isDirector, buttonStates, currentLayout } =
    useMediaPermissions();
  const previousScreenShareAllowed = useRef(buttonStates.screenShare.enabled);
  const previousCameraAllowed = useRef(buttonStates.camera.enabled);
  const previousMicrophoneAllowed = useRef(buttonStates.microphone.enabled);
  // Check if the local participant is the presenter by comparing with room metadata
  const roomPresenter = parseRoomMetadata(roomInfo?.metadata)?.presenter;
  const isPresenter = localParticipant?.identity === roomPresenter;
  const role = getUserRole(isDirector, isPresenter);
  const permissions = ROLE_PERMISSIONS[role];

  const toggleMicrophone = async () => {
    if (!localParticipant) return;

    try {
      const newState = !localParticipant.isMicrophoneEnabled;
      if (newState) {
        // When enabling, use stored device preference if available
        const storedDevice = sessionStorage.getItem("prejoin-audio-device");
        const publishOptions = storedDevice
          ? { deviceId: storedDevice }
          : undefined;

        console.log("[DEBUG] Microphone publishing:", {
          enabled: true,
          deviceId: storedDevice || "default",
          participantIdentity: localParticipant.identity,
          participantSid: localParticipant.sid,
          timestamp: new Date().toISOString(),
        });

        await localParticipant.setMicrophoneEnabled(true, publishOptions);
      } else {
        console.log("[DEBUG] Microphone unpublishing:", {
          enabled: false,
          participantIdentity: localParticipant.identity,
          participantSid: localParticipant.sid,
          timestamp: new Date().toISOString(),
        });
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch (error) {
      console.error("Error toggling microphone:", error);
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;

    try {
      const newState = !localParticipant.isCameraEnabled;
      if (newState) {
        // Get streaming settings from session storage
        let videoResolution = VideoPresets.h1080.resolution;
        const storedSettings = sessionStorage.getItem("streaming-settings");
        if (storedSettings) {
          try {
            const settings = JSON.parse(storedSettings);
            const preset = settings.videoResolution;
            if (preset && preset in VideoPresets) {
              videoResolution =
                VideoPresets[preset as keyof typeof VideoPresets].resolution;
            }
          } catch (e) {
            console.error("Error parsing streaming settings:", e);
          }
        }

        // When enabling, use stored device preference if available
        const storedDevice = sessionStorage.getItem("prejoin-video-device");
        const publishOptions = {
          ...(storedDevice ? { deviceId: storedDevice } : {}),
          resolution: videoResolution,
        };

        console.log("[DEBUG] Camera publishing:", {
          enabled: true,
          deviceId: storedDevice || "default",
          resolution: `${videoResolution.width}x${videoResolution.height}`,
          participantIdentity: localParticipant.identity,
          participantSid: localParticipant.sid,
          streamingSettings: storedSettings,
          timestamp: new Date().toISOString(),
        });

        await localParticipant.setCameraEnabled(true, publishOptions);
      } else {
        console.log("[DEBUG] Camera unpublishing:", {
          enabled: false,
          participantIdentity: localParticipant.identity,
          participantSid: localParticipant.sid,
          timestamp: new Date().toISOString(),
        });
        await localParticipant.setCameraEnabled(false);
      }
    } catch (error) {
      console.error("Error toggling camera:", error);
    }
  };

  const toggleScreenShare = async () => {
    if (!localParticipant) return;

    try {
      const newState = !localParticipant.isScreenShareEnabled;

      // Get streaming settings from session storage
      let screenShareResolution = VideoPresets.h1080.resolution;
      let screenShareBitrate = 10_000_000;
      let screenShareFramerate = 60;

      const storedSettings = sessionStorage.getItem("streaming-settings");
      if (storedSettings) {
        try {
          const settings = JSON.parse(storedSettings);
          if (settings) {
            const preset = settings.screenShareResolution;
            if (preset && preset in VideoPresets) {
              screenShareResolution =
                VideoPresets[preset as keyof typeof VideoPresets].resolution;
            }
            screenShareBitrate =
              settings.screenShareBitrate || screenShareBitrate;
            screenShareFramerate =
              settings.screenShareFramerate || screenShareFramerate;
          }
        } catch (e) {
          console.error("Error parsing streaming settings:", e);
        }
      }

      if (newState) {
        console.log("[DEBUG] Screen share publishing:", {
          enabled: true,
          resolution: `${screenShareResolution.width}x${screenShareResolution.height}`,
          maxBitrate: screenShareBitrate,
          maxFramerate: screenShareFramerate,
          contentHint: "detail",
          selfBrowserSurface: "exclude",
          participantIdentity: localParticipant.identity,
          participantSid: localParticipant.sid,
          streamingSettings: storedSettings,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log("[DEBUG] Screen share unpublishing:", {
          enabled: false,
          participantIdentity: localParticipant.identity,
          participantSid: localParticipant.sid,
          timestamp: new Date().toISOString(),
        });
      }

      await localParticipant.setScreenShareEnabled(
        newState,
        {
          resolution: screenShareResolution,
          selfBrowserSurface: "exclude", // Exclude the current tab from capture options
          contentHint: "detail", // Optimize for detailed content like text
        },
        {
          screenShareEncoding: {
            maxBitrate: screenShareBitrate,
            maxFramerate: screenShareFramerate,
          },
        },
      );
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  // Monitor layout changes and stop screensharing if not allowed
  useEffect(() => {
    const isScreenShareAllowed = buttonStates.screenShare.enabled;
    const wasScreenShareAllowed = previousScreenShareAllowed.current;

    // If screenshare permission was revoked (layout changed to one that doesn't allow it)
    if (
      !isScreenShareAllowed &&
      wasScreenShareAllowed &&
      localParticipant?.isScreenShareEnabled
    ) {
      console.log(
        "[DEBUG] Stopping screenshare due to layout change - screenshare not allowed in new layout",
        {
          currentLayout,
          isScreenShareEnabled: localParticipant.isScreenShareEnabled,
          timestamp: new Date().toISOString(),
        },
      );

      // Stop screensharing silently (no toast for layout-driven changes)
      localParticipant.setScreenShareEnabled(false).catch((error) => {
        console.error(
          "Error stopping screen share after layout change:",
          error,
        );
      });
    }

    // Update the ref for next comparison
    previousScreenShareAllowed.current = isScreenShareAllowed;
  }, [buttonStates.screenShare.enabled, localParticipant, currentLayout]);

  // Monitor layout changes and stop camera if not allowed
  useEffect(() => {
    const isCameraAllowed = buttonStates.camera.enabled;
    const wasCameraAllowed = previousCameraAllowed.current;

    // If camera permission was revoked (layout changed to one that doesn't allow it)
    if (
      !isCameraAllowed &&
      wasCameraAllowed &&
      localParticipant?.isCameraEnabled
    ) {
      console.log(
        "[DEBUG] Stopping camera due to layout change - camera not allowed in new layout",
        {
          currentLayout,
          isCameraEnabled: localParticipant.isCameraEnabled,
          isPresenter,
          role,
          timestamp: new Date().toISOString(),
        },
      );

      // Stop camera silently (no toast for layout-driven changes)
      localParticipant.setCameraEnabled(false).catch((error) => {
        console.error("Error stopping camera after layout change:", error);
      });
    }

    // Update the ref for next comparison
    previousCameraAllowed.current = isCameraAllowed;
  }, [
    buttonStates.camera.enabled,
    localParticipant,
    currentLayout,
    isPresenter,
    role,
  ]);

  // Monitor layout changes and stop microphone if not allowed
  useEffect(() => {
    const isMicrophoneAllowed = buttonStates.microphone.enabled;
    const wasMicrophoneAllowed = previousMicrophoneAllowed.current;

    // If microphone permission was revoked (layout changed to one that doesn't allow it)
    if (
      !isMicrophoneAllowed &&
      wasMicrophoneAllowed &&
      localParticipant?.isMicrophoneEnabled
    ) {
      console.log(
        "[DEBUG] Stopping microphone due to layout change - microphone not allowed in new layout",
        {
          currentLayout,
          isMicrophoneEnabled: localParticipant.isMicrophoneEnabled,
          isPresenter,
          role,
          timestamp: new Date().toISOString(),
        },
      );

      // Stop microphone silently (no toast for layout-driven changes)
      localParticipant.setMicrophoneEnabled(false).catch((error) => {
        console.error("Error stopping microphone after layout change:", error);
      });
    }

    // Update the ref for next comparison
    previousMicrophoneAllowed.current = isMicrophoneAllowed;
  }, [
    buttonStates.microphone.enabled,
    localParticipant,
    currentLayout,
    isPresenter,
    role,
  ]);

  const handleLeaveRoom = () => {
    // Emit custom event to signal room leave
    const event = new CustomEvent("livekit-leave-room");
    document.dispatchEvent(event);
  };

  return (
    <TooltipProvider>
      <div className="grid grid-cols-4 gap-2 w-full">
        {/* Media controls - only for people with publish rights */}
        {canPublish && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    variant={
                      localParticipant?.isMicrophoneEnabled
                        ? "default"
                        : "secondary"
                    }
                    size="icon"
                    onClick={toggleMicrophone}
                    disabled={!buttonStates.microphone.enabled}
                    className="h-9 w-full rounded-md transition-all hover:scale-105 disabled:pointer-events-none"
                  >
                    {localParticipant?.isMicrophoneEnabled ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{buttonStates.microphone.tooltip}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    variant={
                      localParticipant?.isCameraEnabled
                        ? "default"
                        : "secondary"
                    }
                    size="icon"
                    onClick={toggleCamera}
                    disabled={!buttonStates.camera.enabled}
                    className="h-9 w-full rounded-md transition-all hover:scale-105 disabled:pointer-events-none"
                  >
                    {localParticipant?.isCameraEnabled ? (
                      <Video className="h-4 w-4" />
                    ) : (
                      <VideoOff className="h-4 w-4" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{buttonStates.camera.tooltip}</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    variant={
                      localParticipant?.isScreenShareEnabled
                        ? "default"
                        : "secondary"
                    }
                    size="icon"
                    onClick={toggleScreenShare}
                    disabled={!buttonStates.screenShare.enabled}
                    className="h-9 w-full rounded-md transition-all hover:scale-105 disabled:pointer-events-none"
                  >
                    {localParticipant?.isScreenShareEnabled ? (
                      <ScreenShareOff className="h-4 w-4" />
                    ) : (
                      <ScreenShare className="h-4 w-4" />
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{buttonStates.screenShare.tooltip}</p>
              </TooltipContent>
            </Tooltip>

            <SettingsDialog />
          </>
        )}

        {/* Backstage toggle - based on permissions */}
        {permissions.canToggleBackstage && <BackstageToggle />}

        {/* Presenter selector - based on permissions */}
        {permissions.canSelectPresenter && <PresenterSelector />}

        {/* Layout selector - based on permissions */}
        {permissions.canSelectLayout && <LayoutSelector token={token} />}

        {/* Raise hand button - based on permissions */}
        {permissions.canRaiseHand && <RaiseHandButton token={token} />}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              onClick={handleLeaveRoom}
              className="h-9 w-full rounded-md transition-all hover:scale-105 shadow-lg shadow-red-600/20"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Leave room</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

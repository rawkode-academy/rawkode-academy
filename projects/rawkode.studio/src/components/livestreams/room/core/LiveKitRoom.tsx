import { cn } from "@/lib/utils";
import {
  LayoutContextProvider,
  LiveKitRoom as LiveKitRoomComponent,
  RoomAudioRenderer,
  useLocalParticipant,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Chat } from "@/components/livestreams/room/chat/Chat";
import { RaiseHandProvider } from "@/components/livestreams/room/controls/RaiseHandContext";
import { RaiseHandContext } from "@/components/livestreams/room/controls/RaiseHandContext";
import { ControlsSection } from "@/components/livestreams/room/core/ControlsSection";
import { LayoutProvider } from "@/components/livestreams/room/core/LayoutContext";
import { PermissionHandler } from "@/components/livestreams/room/core/PermissionHandler";
import { ConnectionIndicator } from "@/components/livestreams/room/media/ConnectionIndicator";
import { VideoGrid } from "@/components/livestreams/room/media/VideoGrid";
import { ParticipantsList } from "@/components/livestreams/room/participants/ParticipantsList";
import { Alert, AlertDescription, AlertTitle } from "@/components/shadcn/alert";
import { Button } from "@/components/shadcn/button";
import { Card } from "@/components/shadcn/card";
import { Progress } from "@/components/shadcn/progress";
import { ScrollArea } from "@/components/shadcn/scroll-area";
import { Separator } from "@/components/shadcn/separator";
import { useLivestreamToken } from "@/hooks/useLivestreamToken";
import { useParticipantInfo } from "@/hooks/useParticipantInfo";
import { useRoomConnection } from "@/hooks/useRoomConnection";
import { ConnectionState, RoomEvent, VideoPresets } from "livekit-client";
import { AlertCircle, Loader2 } from "lucide-react";
import { useContext, useEffect } from "react";

// Props interface
export interface LiveKitRoomProps {
  serverUrl: string;
  roomName: string;
  roomDisplayName: string;
  participantName?: string;
  onLeaveRoom?: (roomName: string) => void;
  className?: string;
}

export default function LiveKitRoom({
  serverUrl,
  roomName,
  roomDisplayName,
  participantName: propParticipantName,
  onLeaveRoom,
  className,
}: LiveKitRoomProps) {
  // Custom hooks
  const { participantName, initialMediaSettings } =
    useParticipantInfo(propParticipantName);
  const {
    connectionState,
    error,
    setError,
    handleConnected,
    handleDisconnected,
    handleError,
  } = useRoomConnection({ roomName, onLeaveRoom });

  // Get token
  const {
    token,
    isLoading: tokenLoading,
    error: tokenError,
  } = useLivestreamToken({
    roomName,
    participantName,
  });

  // Handle token error
  if (tokenError && !error) {
    setError(tokenError.message);
  }

  // Loading state
  if (tokenLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-background/95">
        <Card className="p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-primary" />
            <h3 className="text-lg font-semibold">Loading token...</h3>
            <Progress value={20} className="w-48" />
            <p className="text-sm text-muted-foreground">Room: {roomName}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-background/95">
        <div className="max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            className="w-full mt-4"
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

  // No token state
  if (!token) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-background/95">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Token</AlertTitle>
          <AlertDescription>
            Failed to get access token for the room.
          </AlertDescription>
          <div className="mt-4">
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <>
      <LiveKitRoomComponent
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={initialMediaSettings.video}
        audio={initialMediaSettings.audio}
        options={{
          videoCaptureDefaults: {
            deviceId: initialMediaSettings.videoDeviceId,
            resolution: VideoPresets.h1080.resolution,
          },
          audioCaptureDefaults: {
            deviceId: initialMediaSettings.audioDeviceId,
          },
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            videoCodec: "vp9", // Use VP9 codec for better quality at lower bitrates
            videoEncoding: {
              maxBitrate: 10_000_000, // 10 Mbps for 1080p video
              maxFramerate: 60,
            },
            screenShareEncoding: {
              maxBitrate: 10_000_000, // 10 Mbps default for screen share
              maxFramerate: 60,
            },
            simulcast: false, // Disable simulcast for single high-quality stream
          },
        }}
        onConnected={() => {
          console.log(
            "[DEBUG] LiveKit Room connected with publishing defaults:",
            {
              videoEnabled: initialMediaSettings.video,
              audioEnabled: initialMediaSettings.audio,
              videoDeviceId: initialMediaSettings.videoDeviceId || "default",
              audioDeviceId: initialMediaSettings.audioDeviceId || "default",
              videoResolution: "1920x1080",
              videoCodec: "vp9",
              videoMaxBitrate: 10_000_000,
              videoMaxFramerate: 60,
              screenShareMaxBitrate: 10_000_000,
              screenShareMaxFramerate: 60,
              adaptiveStream: true,
              dynacast: true,
              simulcast: false,
              timestamp: new Date().toISOString(),
            },
          );
          handleConnected();
        }}
        onDisconnected={handleDisconnected}
        onError={handleError}
        className={cn("relative fixed inset-0 bg-background z-20", className)}
        data-lk-theme="default"
      >
        <RaiseHandProvider>
          <LayoutContextProvider>
            <LayoutProvider>
              <DataMessageHandler />
              <RoomContent
                roomDisplayName={roomDisplayName}
                token={token}
                connectionState={connectionState}
              />
              <RoomAudioRenderer />
              <PermissionHandler />
            </LayoutProvider>
          </LayoutContextProvider>
        </RaiseHandProvider>
      </LiveKitRoomComponent>
    </>
  );
}

// Room content component
interface RoomContentProps {
  roomDisplayName: string;
  token: string;
  connectionState: ConnectionState;
}

function RoomContent({
  roomDisplayName,
  token,
  connectionState,
}: RoomContentProps) {
  return (
    <div className="fixed inset-0 flex">
      {/* Main video grid area */}
      <div className="flex-1 h-full overflow-hidden">
        <VideoGrid />
      </div>

      {/* Right sidebar */}
      <div
        className={cn(
          "w-80 h-full bg-sidebar/90 backdrop-blur-md border-l border-sidebar-border/50 flex flex-col overflow-hidden",
          connectionState !== ConnectionState.Connected &&
            "pointer-events-none opacity-90",
        )}
      >
        {/* Header */}
        <div className="p-3 border-b border-sidebar-border/50">
          <div className="flex items-center justify-center gap-2">
            <span className="font-bold text-sidebar-foreground">
              {roomDisplayName}
            </span>
            <ConnectionIndicator
              status={
                connectionState === ConnectionState.Connected
                  ? "connected"
                  : connectionState === ConnectionState.Reconnecting
                    ? "reconnecting"
                    : connectionState === ConnectionState.Connecting
                      ? "connecting"
                      : "disconnected"
              }
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-3 flex flex-col">
          {connectionState === ConnectionState.Connected ? (
            <div className="flex flex-col h-full">
              <ControlsSection token={token} />
              <Separator className="my-3" />

              {/* Container for participants and chat */}
              <div className="flex-1 flex flex-col min-h-0">
                {/* Participants Section */}
                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="px-2">
                      <ParticipantsList token={token} />
                    </div>
                  </ScrollArea>
                </div>

                <Separator className="my-2" />

                {/* Chat Section */}
                <div className="flex-1 min-h-0">
                  <Chat token={token} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Loader2 className="size-8 animate-spin mx-auto mb-2" />
                <p>Connecting to room...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Data message handler component for raise hand functionality
function DataMessageHandler() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { setRaisedHand } = useContext(RaiseHandContext);

  useEffect(() => {
    if (!room || !localParticipant) return;

    const handleDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      _topic?: string,
    ) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));

        switch (message.type) {
          case "raise_hand_request": {
            // Handle raise hand requests (all participants see these)
            setRaisedHand(message.identity, message.raised, message.timestamp);
            break;
          }

          case "raise_hand_response":
            // Handle responses to raise hand requests (all participants see these)
            // Always clear the raised hand regardless of approval status
            setRaisedHand(message.targetIdentity, false, message.timestamp);
            break;
        }
      } catch (error) {
        console.error("Error parsing data message:", error);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, localParticipant, setRaisedHand]);

  return null;
}

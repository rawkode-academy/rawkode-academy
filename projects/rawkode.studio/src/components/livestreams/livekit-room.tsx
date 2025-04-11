import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import { Button } from "@/components/shadcn/button";
import { Separator } from "@/components/shadcn/separator";
import { Skeleton } from "@/components/shadcn/skeleton";
import { cn } from "@/lib/utils";
import {
  LayoutContextProvider,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useChat,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import {
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  ScreenShare,
  Signal,
  Users,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Define props interface
export interface LivekitRoomProps {
  serverUrl: string;
  onLeaveRoom?: (roomName: string) => void;
  className?: string;
}

// Connection indicator component
function ConnectionIndicator({ status }: { status: string }) {
  return (
    <div className="w-full mb-2 flex items-center">
      <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs bg-sidebar-accent/20 border border-sidebar-border/20">
        <div className="flex items-center gap-1.5">
          {status === "connected"
            ? (
              <>
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">Connected</span>
              </>
            )
            : status === "connecting"
            ? (
              <>
                <Signal className="h-3 w-3 text-amber-500 animate-pulse" />
                <span className="text-amber-500 font-medium">
                  Connecting...
                </span>
              </>
            )
            : (
              <>
                <WifiOff className="h-3 w-3 text-red-500" />
                <span className="text-red-500 font-medium">Disconnected</span>
              </>
            )}
        </div>
        <div className="flex items-center gap-1">
          {status === "connected" && (
            <span className="inline-block w-2 h-2 rounded-full bg-green-500">
            </span>
          )}
          {status === "connecting" && (
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse">
            </span>
          )}
          {status === "disconnected" && (
            <span className="inline-block w-2 h-2 rounded-full bg-red-500">
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LivekitRoomWrapper({
  serverUrl,
  onLeaveRoom,
  className,
}: LivekitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string>(
    "connecting",
  );

  // Get tokens from sessionStorage
  useEffect(() => {
    const refreshFromSessionStorage = () => {
      try {
        const fetchedToken = sessionStorage.getItem("livekit-token");
        const fetchedRoom = sessionStorage.getItem("livekit-room");

        if (fetchedToken && fetchedRoom) {
          setToken(fetchedToken);
          setRoomName(fetchedRoom);
        }
      } catch (err) {
        console.error("Error refreshing session tokens:", err);
        setError("Failed to load session data");
      }
    };

    refreshFromSessionStorage();

    // Set up an interval to check for token updates
    const intervalId = setInterval(refreshFromSessionStorage, 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Listen for refresh tokens event
  useEffect(() => {
    const refreshTokens = () => {
      try {
        const fetchedToken = sessionStorage.getItem("livekit-token");
        const fetchedRoom = sessionStorage.getItem("livekit-room");

        if (fetchedToken && fetchedRoom) {
          setToken(fetchedToken);
          setRoomName(fetchedRoom);
        }
      } catch (err) {
        console.error("Error refreshing event tokens:", err);
        setError("Failed to update session data");
      }
    };

    document.addEventListener("livekit-refresh-tokens", refreshTokens);

    return () => {
      document.removeEventListener("livekit-refresh-tokens", refreshTokens);
    };
  }, []);

  // Listen for leave room event
  useEffect(() => {
    const leaveRoomHandler = () => {
      if (roomName) handleLeaveRoom(roomName);
    };

    document.addEventListener("livekit-leave-room", leaveRoomHandler);

    return () => {
      document.removeEventListener("livekit-leave-room", leaveRoomHandler);
    };
  }, [roomName]);

  // Handle browser permissions errors
  useEffect(() => {
    const handlePermissionError = (e: ErrorEvent) => {
      console.log("Caught error:", e);
      if (
        e.message &&
        (e.message.includes("Permission denied") ||
          e.message.includes("NotAllowedError") ||
          e.message.includes("NotFoundError"))
      ) {
        setError(
          "Media permission denied. Please allow camera/microphone access in your browser settings.",
        );
      }
    };

    window.addEventListener("error", handlePermissionError);
    return () => window.removeEventListener("error", handlePermissionError);
  }, []);

  // Handle room leave/disconnect with fallback if callback is not provided
  const handleLeaveRoom = (name: string) => {
    try {
      // Clear tokens
      sessionStorage.removeItem("livekit-token");
      sessionStorage.removeItem("livekit-room");
      setConnectionStatus("disconnected");

      // Call the callback if it exists and is a function
      if (typeof onLeaveRoom === "function") {
        onLeaveRoom(name);
      } else {
        // Fallback: redirect to invite page
        if (name) {
          window.location.href = `/invite/${name}`;
        }
      }
    } catch (err) {
      console.error("Error leaving room:", err);
      // Still try to redirect even if there was an error
      if (name) {
        window.location.href = `/invite/${name}`;
      }
    }
  };

  // Show an error message if we encountered a problem
  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4 bg-background/95">
        <div className="max-w-md w-full">
          <div className="mb-4 p-4 border border-destructive bg-destructive/10 text-destructive rounded-md">
            <h3 className="font-semibold">Connection Error</h3>
            <p className="text-sm">{error}</p>
          </div>
          <Button
            className="w-full py-2 px-4"
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

  if (!token || !roomName) {
    return null;
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      video={false}
      audio={false}
      onDisconnected={(reason) => {
        console.log("Room disconnected:", reason);
        setConnectionStatus("disconnected");
        if (roomName) handleLeaveRoom(roomName);
      }}
      onConnected={() => {
        console.log("Room connected successfully");
        setConnectionStatus("connected");
        document.dispatchEvent(new CustomEvent("livekit-refresh-tokens"));
      }}
      onError={(err) => {
        console.error("Room connection error:", err);
        setConnectionStatus("error");

        // Handle specific error cases
        if (
          err.message.includes("room not found") ||
          err.message.includes("room does not exist") ||
          err.message.includes("not found") ||
          err.message.includes("404")
        ) {
          setError(
            `Room "${roomName}" doesn't exist. You cannot create rooms by joining them.`,
          );
        } else if (err.message.includes("permission")) {
          setError(`You don't have permission to join room "${roomName}".`);
        } else if (err.message.includes("token")) {
          setError(
            `Invalid or expired token. Please request a new invitation.`,
          );
        } else {
          setError(`Connection error: ${err.message}`);
        }
      }}
      className={cn(
        "relative fixed inset-0 bg-background z-20",
        className,
      )}
    >
      <LayoutContextProvider>
        <div className="fixed inset-0 flex">
          {/* Main video grid area */}
          <div className="flex-1 h-full overflow-hidden">
            <VideoGrid />
          </div>

          {/* Right sidebar */}
          <div
            className={cn(
              "w-80 h-full bg-sidebar/90 backdrop-blur-md border-l border-sidebar-border/50 flex flex-col overflow-hidden",
              connectionStatus !== "connected" &&
                "pointer-events-none opacity-90",
            )}
          >
            <div className="p-3 border-b border-sidebar-border/50 space-y-2">
              <div className="text-center font-bold text-sidebar-foreground">
                {roomName}
              </div>
              <ConnectionIndicator status={connectionStatus} />
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 flex flex-col">
              {connectionStatus === "connected"
                ? (
                  <>
                    <RoomControls />
                    <Separator />
                    <div className="flex-1 grid grid-rows-2 gap-4 min-h-0">
                      <ParticipantsList />
                      <ChatWithLiveKit />
                    </div>
                  </>
                )
                : (
                  <>
                    {/* Skeleton UI while connecting */}
                    <div className="mb-4">
                      <Skeleton className="h-6 w-24 mb-3" />
                      <div className="grid grid-cols-2 gap-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </div>
                    <Separator />
                    <div className="flex-1 grid grid-rows-2 gap-4 min-h-0">
                      {/* Participants list skeleton */}
                      <div className="flex flex-col h-full min-h-0">
                        <Skeleton className="h-6 w-32 mb-3" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                          <Skeleton className="h-12 w-full" />
                        </div>
                      </div>

                      {/* Chat skeleton */}
                      <div className="flex flex-col h-full min-h-0">
                        <Skeleton className="h-6 w-16 mb-3" />
                        <Skeleton className="flex-1 w-full mb-3" />
                        <div className="flex gap-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 w-16" />
                        </div>
                      </div>
                    </div>
                  </>
                )}
            </div>

            <div className="p-2 border-t border-sidebar-border/50">
              {/* Footer content if needed */}
            </div>
          </div>
        </div>
        <RoomAudioRenderer />
      </LayoutContextProvider>
    </LiveKitRoom>
  );
}
// Video Grid Component
function VideoGrid() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      onlySubscribed: true,
    },
  );

  const participants = useParticipants();

  // Check for screen share tracks - if anyone is sharing screen, focus on that
  const screenShareTrack = tracks.find(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      track.publication?.isSubscribed,
  );

  // Empty state if no participants
  if (participants.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 bg-black">
        <div className="text-center p-6 bg-sidebar-accent/20 backdrop-blur-sm rounded-xl shadow-sm max-w-md">
          <h3 className="text-xl font-medium mb-3 text-white">
            Waiting for participants...
          </h3>
          <p className="text-white/70 mb-4 text-sm">
            You're the first one here
          </p>
        </div>
      </div>
    );
  }

  // Filter to only get tracks from participants who have their camera enabled
  const cameraTrackReferences = tracks.filter((track) => {
    // Only include Camera tracks
    if (track.source !== Track.Source.Camera) return false;

    // Check if the participant has their camera enabled
    return track.participant.isCameraEnabled === true;
  });

  // If someone is screen sharing, use a custom layout with screen share and floating participant tiles
  if (screenShareTrack) {
    return (
      <div className="w-full h-full bg-black relative">
        {/* Main screen share takes full screen */}
        <div className="absolute inset-0 w-full h-full">
          <ParticipantTile
            trackRef={screenShareTrack}
            disableSpeakingIndicator={true}
            className="w-full h-full"
          />
        </div>

        {/* Floating participant videos in a vertical column on the right */}
        <div className="absolute top-4 right-4 w-48 max-h-[90%] overflow-y-auto space-y-2 z-10">
          {cameraTrackReferences.map((track) => (
            <div
              key={track.publication?.trackSid}
              className="w-full aspect-video rounded-lg overflow-hidden shadow-lg border border-white/10"
            >
              <ParticipantTile
                trackRef={track}
                disableSpeakingIndicator={false}
                className="w-full h-full"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default 3-column grid when no screen sharing
  return (
    <div className="w-full h-full bg-black p-4">
      <div
        className={`grid gap-4 w-full h-full ${
          cameraTrackReferences.length === 1
            ? "grid-cols-1"
            : cameraTrackReferences.length === 2
            ? "grid-cols-2"
            : cameraTrackReferences.length === 3
            ? "grid-cols-3"
            : cameraTrackReferences.length === 4
            ? "grid-cols-2 grid-rows-2"
            : cameraTrackReferences.length <= 6
            ? "grid-cols-3 grid-rows-2"
            : cameraTrackReferences.length <= 9
            ? "grid-cols-3 grid-rows-3"
            : cameraTrackReferences.length <= 12
            ? "grid-cols-4 grid-rows-3"
            : "grid-cols-4 grid-rows-4"
        }`}
      >
        {cameraTrackReferences.map((track) => (
          <div
            key={track.publication?.trackSid}
            className={`rounded-lg overflow-hidden shadow-md ${
              cameraTrackReferences.length === 1
                ? "w-full h-full"
                : "aspect-video"
            }`}
          >
            <ParticipantTile
              trackRef={track}
              disableSpeakingIndicator={false}
              className="w-full h-full"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Room Controls Component
function RoomControls() {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Default permissions to true initially to show controls while loading
  // This prevents UI flickering and delay
  const [permissions, setPermissions] = useState({
    canPublish: true,
    canPublishData: true,
  });

  // Separate effect to handle permissions loading
  useEffect(() => {
    const checkPermissions = () => {
      if (!room || !room.localParticipant) return;

      // Debug permissions
      console.log("Room token permissions:", room.localParticipant.permissions);

      const perms = room.localParticipant.permissions;
      setPermissions({
        canPublish: !!perms?.canPublish,
        canPublishData: !!perms?.canPublishData,
      });
      setPermissionsLoaded(true);
    };

    // Check permissions immediately
    checkPermissions();

    // And also when connection state changes
    if (room) {
      room.on("connectionStateChanged", checkPermissions);

      return () => {
        room.off("connectionStateChanged", checkPermissions);
      };
    }
  }, [room]);

  // Count available buttons to determine layout
  const availableButtons = [
    permissions.canPublish, // Audio and video require canPublish
    permissions.canPublish,
    permissions.canPublish && permissions.canPublishData, // Screen sharing requires both
    true, // Leave button is always shown
  ].filter(Boolean).length;

  const toggleMicrophone = async () => {
    if (!localParticipant) return;

    console.log(
      "Toggling microphone, current state:",
      localParticipant.isMicrophoneEnabled,
    );

    try {
      const newState = !localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(newState);
      console.log("Microphone toggled successfully to:", newState);
    } catch (error) {
      console.error("Error toggling microphone:", error);
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;

    console.log(
      "Toggling camera, current state:",
      localParticipant.isCameraEnabled,
    );

    try {
      const newState = !localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(newState);
      console.log("Camera toggled successfully to:", newState);
    } catch (error) {
      console.error("Error toggling camera:", error);
    }
  };

  const toggleScreenShare = async () => {
    if (!localParticipant) return;

    console.log(
      "Toggling screen share, current state:",
      localParticipant.isScreenShareEnabled,
    );

    try {
      const newState = !localParticipant.isScreenShareEnabled;
      await localParticipant.setScreenShareEnabled(newState);
      console.log("Screen share toggled successfully to:", newState);
    } catch (error) {
      console.error("Error toggling screen share:", error);
    }
  };

  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium mb-3">Controls</h4>
      <div
        className={`grid ${
          availableButtons === 1 ? "grid-cols-1" : "grid-cols-2"
        } gap-2`}
      >
        {permissions.canPublish && (
          <Button
            size="sm"
            variant={localParticipant?.isMicrophoneEnabled
              ? "default"
              : "secondary"}
            className="flex items-center justify-center h-10 rounded-lg border border-sidebar-border/30 w-full"
            onClick={toggleMicrophone}
            disabled={!permissionsLoaded}
          >
            {localParticipant?.isMicrophoneEnabled
              ? <Mic className="h-4 w-4 mr-2" />
              : <MicOff className="h-4 w-4 mr-2" />}
            {localParticipant?.isMicrophoneEnabled ? "Mute" : "Unmute"}
          </Button>
        )}

        {permissions.canPublish && (
          <Button
            size="sm"
            variant={localParticipant?.isCameraEnabled
              ? "default"
              : "secondary"}
            className="flex items-center justify-center h-10 rounded-lg border border-sidebar-border/30 w-full"
            onClick={toggleCamera}
            disabled={!permissionsLoaded}
          >
            {localParticipant?.isCameraEnabled
              ? <Video className="h-4 w-4 mr-2" />
              : <VideoOff className="h-4 w-4 mr-2" />}
            {localParticipant?.isCameraEnabled ? "Stop Video" : "Start Video"}
          </Button>
        )}

        {permissions.canPublish && permissions.canPublishData && (
          <Button
            size="sm"
            variant={localParticipant?.isScreenShareEnabled
              ? "default"
              : "secondary"}
            className="flex items-center justify-center h-10 rounded-lg border border-sidebar-border/30 w-full"
            onClick={toggleScreenShare}
            disabled={!permissionsLoaded}
          >
            <ScreenShare className="h-4 w-4 mr-2" />
            {localParticipant?.isScreenShareEnabled
              ? "Stop Sharing"
              : "Share Screen"}
          </Button>
        )}

        <Button
          size="sm"
          variant="destructive"
          className="flex items-center justify-center h-10 rounded-lg w-full"
          onClick={() =>
            document.dispatchEvent(new Event("livekit-leave-room"))}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Leave
        </Button>
      </div>
    </div>
  );
}

// Participants List Component
function ParticipantsList() {
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
              {participant.isMicrophoneEnabled
                ? <Mic className="h-3 w-3" />
                : <MicOff className="h-3 w-3 text-sidebar-foreground/50" />}
              {participant.isCameraEnabled
                ? <Video className="h-3 w-3" />
                : <VideoOff className="h-3 w-3 text-sidebar-foreground/50" />}
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

// Chat Section Component using LiveKit's useChat hook
function ChatWithLiveKit() {
  const { chatMessages, send } = useChat();
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <h4 className="text-sm font-medium mb-3 flex items-center flex-shrink-0">
        <MessageSquare className="h-4 w-4 mr-2" />
        Chat
      </h4>

      <div
        className="flex-1 overflow-y-auto pr-1 mb-3 rounded-md bg-sidebar-accent/30 border border-sidebar-border/20 min-h-0"
        style={{ scrollbarWidth: "thin" }}
      >
        <div className="p-3">
          {chatMessages.length === 0
            ? (
              <div className="text-xs text-sidebar-foreground/50 text-center py-2">
                No messages yet
              </div>
            )
            : (
              <div>
                {chatMessages.map((msg, i) => (
                  <div key={i} className="mb-3 last:mb-1">
                    <div className="text-xs font-medium text-sidebar-foreground/80">
                      {msg.from?.name || msg.from?.identity || "Anonymous"}
                    </div>
                    <div className="text-sm mt-1 break-words">
                      {msg.message}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
        </div>
      </div>

      <div className="flex gap-2 flex-shrink-0 mt-auto">
        <input
          type="text"
          className="flex-1 h-9 px-3 py-2 text-sm bg-sidebar-accent/30 border border-sidebar-border/30 rounded-md"
          placeholder="Send a message..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && messageText.trim()) {
              send(messageText);
              setMessageText("");
            }
          }}
        />
        <Button
          size="sm"
          className="h-9 flex-shrink-0"
          onClick={() => {
            if (messageText.trim()) {
              send(messageText);
              setMessageText("");
            }
          }}
        >
          Send
        </Button>
      </div>
    </div>
  );
}

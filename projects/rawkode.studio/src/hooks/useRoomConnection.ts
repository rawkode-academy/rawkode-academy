import { ConnectionState, type DisconnectReason } from "livekit-client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface UseRoomConnectionProps {
  roomName: string;
  onLeaveRoom?: (roomName: string) => void;
}

export function useRoomConnection({
  roomName,
  onLeaveRoom,
}: UseRoomConnectionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [error, setError] = useState<string | null>(null);

  // Handle room leave/disconnect with fallback
  const handleLeaveRoom = useCallback(
    (name: string = roomName) => {
      try {
        setConnectionState(ConnectionState.Disconnected);

        if (typeof onLeaveRoom === "function") {
          onLeaveRoom(name);
        } else {
          // Fallback: redirect to watch page
          if (name) {
            window.location.href = `/watch/${name}`;
          }
        }
      } catch (error) {
        console.error("Error leaving room:", error);
        // Still try to redirect even if there was an error
        if (name) {
          window.location.href = `/watch/${name}`;
        }
      }
    },
    [roomName, onLeaveRoom],
  );

  // Handle connection state changes
  const handleConnected = useCallback(() => {
    setConnectionState(ConnectionState.Connected);
  }, []);

  const handleDisconnected = useCallback(
    (_reason?: DisconnectReason) => {
      setConnectionState(ConnectionState.Disconnected);
      handleLeaveRoom(roomName);
    },
    [roomName, handleLeaveRoom],
  );

  const handleReconnecting = useCallback(() => {
    setConnectionState(ConnectionState.Reconnecting);
    toast.info("Reconnecting to stream...");
  }, []);

  const handleReconnected = useCallback(() => {
    setConnectionState(ConnectionState.Connected);
  }, []);

  const handleError = useCallback(
    (err: Error) => {
      let errorMessage = err.message;

      // Handle specific error cases
      if (
        err.message.includes("room not found") ||
        err.message.includes("room does not exist") ||
        err.message.includes("not found") ||
        err.message.includes("404")
      ) {
        errorMessage = `Room "${roomName}" doesn't exist. You cannot create rooms by joining them.`;
      } else if (err.message.includes("permission")) {
        errorMessage = `You don't have permission to join room "${roomName}".`;
      } else if (err.message.includes("token")) {
        errorMessage =
          "Invalid or expired token. Please request a new invitation.";
      } else {
        errorMessage = `Connection error: ${err.message}`;
      }

      setError(errorMessage);
    },
    [roomName],
  );

  // Listen for leave room event
  useEffect(() => {
    const leaveRoomHandler = () => {
      handleLeaveRoom(roomName);
    };

    document.addEventListener("livekit-leave-room", leaveRoomHandler);

    return () => {
      document.removeEventListener("livekit-leave-room", leaveRoomHandler);
    };
  }, [roomName, handleLeaveRoom]);

  // Handle browser permissions errors
  useEffect(() => {
    const handlePermissionError = (e: ErrorEvent) => {
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

  // Get connection quality info
  const getConnectionQuality = () => {
    switch (connectionState) {
      case ConnectionState.Connected:
        return {
          color: "text-green-500",
          bgColor: "bg-green-500",
          label: "Connected",
        };
      case ConnectionState.Reconnecting:
        return {
          color: "text-yellow-500",
          bgColor: "bg-yellow-500",
          label: "Reconnecting",
        };
      case ConnectionState.Disconnected:
        return {
          color: "text-red-500",
          bgColor: "bg-red-500",
          label: "Disconnected",
        };
      default:
        return {
          color: "text-gray-500",
          bgColor: "bg-gray-500",
          label: "Connecting",
        };
    }
  };

  return {
    connectionState,
    error,
    setError,
    handleConnected,
    handleDisconnected,
    handleReconnecting,
    handleReconnected,
    handleError,
    handleLeaveRoom,
    connectionQuality: getConnectionQuality(),
  };
}

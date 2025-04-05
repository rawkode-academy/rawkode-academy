import { useCallback, useEffect, useState } from "react";
import {
  ControlBar,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Spinner } from "../common/Spinner";

interface LivekitRoomProps {
  serverUrl: string;
  isDirector?: boolean;
  onLeaveRoom?: (roomName: string, isDirector: boolean) => void;
}

export default function LivekitRoom(
  { serverUrl, isDirector = false, onLeaveRoom }: LivekitRoomProps,
) {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to load tokens from sessionStorage
  const loadTokens = useCallback(() => {
    const storedToken = sessionStorage.getItem("livekit-token");
    const storedRoom = sessionStorage.getItem("livekit-room");

    console.log("LivekitRoom: Loading tokens from sessionStorage", {
      hasToken: !!storedToken,
      hasRoom: !!storedRoom,
      isDirector,
    });

    setToken(storedToken);
    setRoomName(storedRoom);
    setLoading(false);
  }, [isDirector]);

  // Initial load
  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Set up a listener for token changes
  useEffect(() => {
    // Custom event for refreshing the tokens
    const handleRefresh = () => {
      console.log("LivekitRoom: Refresh event received");
      loadTokens();
    };

    // Listen for the custom refresh event
    document.addEventListener("livekit-refresh-tokens", handleRefresh);

    // Check for new tokens every second for 10 seconds (fallback)
    let checkCount = 0;
    const tokenCheckInterval = setInterval(() => {
      const currentToken = sessionStorage.getItem("livekit-token");
      if (!token && currentToken) {
        console.log("LivekitRoom: Found new token in interval check");
        loadTokens();
      }

      checkCount++;
      if (checkCount >= 10) {
        clearInterval(tokenCheckInterval);
      }
    }, 1000);

    return () => {
      document.removeEventListener("livekit-refresh-tokens", handleRefresh);
      clearInterval(tokenCheckInterval);
    };
  }, [token, loadTokens]);

  // Handle the disconnection event
  const handleDisconnect = () => {
    console.log("Disconnect event triggered", { roomName, isDirector });

    if (onLeaveRoom && roomName) {
      console.log("Calling onLeaveRoom with:", roomName);
      onLeaveRoom(roomName, isDirector);
    } else {
      console.log("Cannot redirect: missing callback or roomName", {
        hasCallback: !!onLeaveRoom,
        roomName,
      });
      // Fallback behavior if callback doesn't work
      if (roomName) {
        // Clear tokens for non-directors to prevent auto-rejoin
        if (!isDirector) {
          console.log("Clearing tokens for non-director (fallback)");
          sessionStorage.removeItem("livekit-token");
          sessionStorage.removeItem("livekit-room");
          sessionStorage.setItem("user-left-voluntarily", "true");
        }
        window.location.href = `/invite/${roomName}`;
      } else {
        window.location.href = "/";
      }
    }
  };

  // Add an event listener for beforeunload to handle page close/refresh
  useEffect(() => {
    if (roomName) {
      const handleBeforeUnload = () => {
        // Log before the page unloads
        console.log("Page unloading, redirecting to invite page");

        // Store the redirect location in session storage to handle after refresh
        sessionStorage.setItem("redirect-after-stream", `/invite/${roomName}`);
      };

      window.addEventListener("beforeunload", handleBeforeUnload);

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [roomName]);

  // Check for redirect after refresh
  useEffect(() => {
    const redirectPath = sessionStorage.getItem("redirect-after-stream");
    if (redirectPath) {
      console.log("Found redirect path after stream:", redirectPath);
      sessionStorage.removeItem("redirect-after-stream");
      window.location.href = redirectPath;
    }
  }, []);

  // If no token or room, show an error
  if (!token || !roomName) {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <Spinner />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold mb-4">Error Joining Stream</h1>
        <p className="text-muted-foreground mb-6">
          No valid room or access token found.
        </p>
        <a
          href={`/invite/${roomName || ""}`}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Return to Invitation
        </a>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      data-lk-theme="default"
      style={{ height: "100vh" }}
      onDisconnected={handleDisconnect}
    >
      <VideoConference />
      <RoomAudioRenderer />
      <ControlBar />
    </LiveKitRoom>
  );
}

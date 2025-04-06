import { useEffect, useState } from "react";
import {
  ControlBar,
  LayoutContextProvider,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";

// Define props interface
export interface LivekitRoomProps {
  serverUrl: string;
  onLeaveRoom?: (roomName: string) => void;
}

export default function LivekitRoomWrapper({
  serverUrl,
  onLeaveRoom,
}: LivekitRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);

  // Get tokens from sessionStorage
  useEffect(() => {
    const refreshFromSessionStorage = () => {
      const fetchedToken = sessionStorage.getItem("livekit-token");
      const fetchedRoom = sessionStorage.getItem("livekit-room");

      if (fetchedToken && fetchedRoom) {
        setToken(fetchedToken);
        setRoomName(fetchedRoom);
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
      const fetchedToken = sessionStorage.getItem("livekit-token");
      const fetchedRoom = sessionStorage.getItem("livekit-room");

      if (fetchedToken && fetchedRoom) {
        setToken(fetchedToken);
        setRoomName(fetchedRoom);
      }
    };

    document.addEventListener("livekit-refresh-tokens", refreshTokens);

    return () => {
      document.removeEventListener("livekit-refresh-tokens", refreshTokens);
    };
  }, []);

  // Handle room leave/disconnect with fallback if callback is not provided
  const handleLeaveRoom = (name: string) => {
    // Clear tokens
    sessionStorage.removeItem("livekit-token");
    sessionStorage.removeItem("livekit-room");

    // Call the callback if it exists and is a function
    if (typeof onLeaveRoom === "function") {
      onLeaveRoom(name);
    } else {
      // Fallback: redirect to invite page
      if (name) {
        window.location.href = `/invite/${name}`;
      }
    }
  };

  if (!token || !roomName) {
    return null;
  }

  return (
    <LayoutContextProvider>
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect={true}
        video={false}
        audio={false}
        onDisconnected={() => {
          if (roomName) {
            handleLeaveRoom(roomName);
          }
        }}
        onConnected={() => {
          // Dispatch event to notify that room has been joined
          document.dispatchEvent(new CustomEvent("livekit-refresh-tokens"));
        }}
        data-lk-theme="default"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 20,
        }}
      >
        <VideoConference />
        <RoomAudioRenderer />
        <ControlBar
          variation="minimal"
          controls={{
            microphone: true,
            camera: true,
            screenShare: true,
            leave: true,
            settings: true,
          }}
        />
      </LiveKitRoom>
    </LayoutContextProvider>
  );
}

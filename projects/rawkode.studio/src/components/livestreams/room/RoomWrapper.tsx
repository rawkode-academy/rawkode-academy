import { PrejoinScreen } from "@/components/livestreams/prejoin/PrejoinScreen";
import LiveKitRoom from "@/components/livestreams/room/core/LiveKitRoom";
import type { LocalUserChoices } from "@livekit/components-core";
import { useState } from "react";

interface RoomWrapperProps {
  serverUrl: string;
  roomName: string;
  roomDisplayName: string;
  roomExists: boolean;
  isDirector: boolean;
  username?: string;
  isAuthenticated: boolean;
}

export function RoomWrapper({
  serverUrl,
  roomName,
  roomDisplayName,
  roomExists,
  isDirector,
  username,
  isAuthenticated,
}: RoomWrapperProps) {
  const [showPrejoin, setShowPrejoin] = useState(true);
  const [displayName, setDisplayName] = useState<string | undefined>(username);

  const handleJoin = (choices: LocalUserChoices) => {
    // Update state to show room
    setDisplayName(choices.username);
    setShowPrejoin(false);
  };

  const handleLeaveRoom = () => {
    // Reload to show prejoin again
    window.location.reload();
  };

  if (showPrejoin) {
    return (
      <PrejoinScreen
        roomDisplayName={roomDisplayName}
        roomExists={roomExists}
        isDirector={isDirector}
        username={username}
        isAuthenticated={isAuthenticated}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      roomName={roomName}
      roomDisplayName={roomDisplayName}
      displayName={displayName}
      onLeaveRoom={handleLeaveRoom}
    />
  );
}

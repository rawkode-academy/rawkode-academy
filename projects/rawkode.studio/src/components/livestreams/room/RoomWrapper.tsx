import { PrejoinScreen } from "@/components/livestreams/prejoin/PrejoinScreen";
import LiveKitRoom from "@/components/livestreams/room/core/LiveKitRoom";
import type { LocalUserChoices } from "@livekit/components-core";
import { useEffect, useState } from "react";

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

  // Check if user has already completed prejoin
  useEffect(() => {
    const prejoinCompleted = sessionStorage.getItem("prejoin-completed");
    const lastRoom = sessionStorage.getItem("last-room-display-name");

    if (prejoinCompleted === "true" && roomDisplayName === lastRoom) {
      // User already went through prejoin, skip it
      // Display name is now handled through LiveKit participant attributes
      setShowPrejoin(false);
    } else {
      // Clear old prejoin data if switching rooms
      sessionStorage.removeItem("prejoin-completed");
      sessionStorage.removeItem("prejoin-audio-enabled");
      sessionStorage.removeItem("prejoin-video-enabled");
      sessionStorage.removeItem("prejoin-audio-device");
      sessionStorage.removeItem("prejoin-video-device");
    }

    // Store current room display name
    sessionStorage.setItem("last-room-display-name", roomDisplayName);
  }, [roomDisplayName]);

  const handleJoin = (choices: LocalUserChoices) => {
    // Store prejoin choices in session storage
    sessionStorage.setItem("prejoin-completed", "true");
    // Display name is passed to LiveKit token, no need to store separately
    sessionStorage.setItem(
      "prejoin-audio-enabled",
      choices.audioEnabled.toString(),
    );
    sessionStorage.setItem(
      "prejoin-video-enabled",
      choices.videoEnabled.toString(),
    );

    if (choices.audioDeviceId) {
      sessionStorage.setItem("prejoin-audio-device", choices.audioDeviceId);
    }
    if (choices.videoDeviceId) {
      sessionStorage.setItem("prejoin-video-device", choices.videoDeviceId);
    }

    // Update state to show room
    setDisplayName(choices.username);
    setShowPrejoin(false);
  };

  const handleLeaveRoom = () => {
    // Clear prejoin flag and reload to show prejoin again
    sessionStorage.removeItem("prejoin-completed");
    sessionStorage.removeItem("prejoin-audio-enabled");
    sessionStorage.removeItem("prejoin-video-enabled");
    sessionStorage.removeItem("prejoin-audio-device");
    sessionStorage.removeItem("prejoin-video-device");
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

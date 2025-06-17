import { actions } from "astro:actions";
import { useQuery } from "@tanstack/react-query";
import * as randomWords from "random-words";
import { useEffect, useRef, useState } from "react";
import { generateRoomId } from "@/lib/generateRoomId";

export type CreationStatus = "idle" | "creating" | "verifying" | "complete";

export interface UseRoomCreationResult {
  // State
  isCreating: boolean;
  creationStatus: CreationStatus;
  createError: string | null;
  roomName: string | null;

  // Actions
  createRoom: () => Promise<void>;
  resetCreationState: () => void;

  // For the dialog
  showDialog: boolean;
  setShowDialog: (show: boolean) => void;

  // For clipboard
  copied: boolean;
  copyToClipboard: () => Promise<void>;
}

export function useRoomCreation(
  onRoomCreated?: () => void,
): UseRoomCreationResult {
  const [isCreating, setIsCreating] = useState(false);
  const [creationStatus, setCreationStatus] = useState<CreationStatus>("idle");
  const [createError, setCreateError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const createdRoomNameRef = useRef<string | null>(null);

  // Room verification query
  const verificationQuery = useQuery({
    queryKey: ["roomCreationVerification", createdRoomNameRef.current],
    queryFn: async () => {
      if (!createdRoomNameRef.current) {
        throw new Error("No room name to verify");
      }

      // Get fresh list of rooms from API
      const { data: freshRooms, error } = await actions.rooms.listRooms();

      if (error) throw error;
      if (!freshRooms) throw new Error("No data received");

      // Check if room exists in the list
      const roomExists = freshRooms.some(
        (room) => room.id === createdRoomNameRef.current,
      );

      // If room doesn't exist yet, throw error to trigger retry
      if (!roomExists) {
        throw new Error("Room not found yet");
      }

      // Return the room name that was verified
      return createdRoomNameRef.current;
    },
    enabled:
      creationStatus === "verifying" && createdRoomNameRef.current !== null,
    refetchInterval: 1000,
    refetchOnWindowFocus: false,
    staleTime: 0,
    retry: 10,
    retryDelay: 1000,
  });

  // Handle successful room verification
  useEffect(() => {
    if (verificationQuery.isSuccess && creationStatus === "verifying") {
      setIsCreating(false);
      setCreationStatus("complete");
      // Set room name from verification to ensure we have the latest
      setRoomName(verificationQuery.data);
      setShowDialog(true);
      createdRoomNameRef.current = null;

      // Call the callback if provided
      if (onRoomCreated) {
        onRoomCreated();
      }
    }
  }, [
    verificationQuery.isSuccess,
    creationStatus,
    verificationQuery.data,
    onRoomCreated,
  ]);

  // Handle max retries reached
  useEffect(() => {
    if (
      verificationQuery.failureCount >= 10 &&
      creationStatus === "verifying"
    ) {
      setCreateError(
        "Room creation took longer than expected. The room may still be creating.",
      );
      setIsCreating(false);
      setCreationStatus("idle");
    }
  }, [verificationQuery.failureCount, creationStatus]);

  const generateInviteLink = (roomName: string) => {
    return `${window.location.origin}/watch/${roomName}`;
  };

  const copyToClipboard = async () => {
    if (!roomName) return;

    try {
      await navigator.clipboard.writeText(generateInviteLink(roomName));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const createRoom = async () => {
    setIsCreating(true);
    setCreationStatus("creating");
    setCreateError(null);

    try {
      // Generate 4 random words and join them with spaces for display name
      const words = randomWords.generate({ exactly: 4 }) as string[];
      const displayName = words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Generate a unique room ID
      const roomId = generateRoomId();

      const response = await actions.rooms.createRoom({
        displayName: displayName,
        roomId: roomId,
        maxParticipants: 10,
        emptyTimeout: 120, // 2 minutes timeout
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to create room");
      }

      if (response.data) {
        // Store the created room ID for verification
        createdRoomNameRef.current = response.data.id;
        // Move to verification stage
        setCreationStatus("verifying");
      }
    } catch (err) {
      console.error("Error creating room:", err);
      setCreateError(
        err instanceof Error ? err.message : "Failed to create room",
      );
      setIsCreating(false);
      setCreationStatus("idle");
      createdRoomNameRef.current = null;
    }
  };

  const resetCreationState = () => {
    setIsCreating(false);
    setCreationStatus("idle");
    setCreateError(null);
    setRoomName(null);
    setShowDialog(false);
    setCopied(false);
    createdRoomNameRef.current = null;
  };

  return {
    // State
    isCreating,
    creationStatus,
    createError,
    roomName,

    // Actions
    createRoom,
    resetCreationState,

    // For the dialog
    showDialog,
    setShowDialog,

    // For clipboard
    copied,
    copyToClipboard,
  };
}

import type { RealtimeKitParticipantRole } from "./participantSources";

export type RealtimeKitRoomPhase = "closed" | "opening" | "setup" | "joined" | "unavailable";

export interface RealtimeKitRoomStatus {
  instructions: string;
  label: string;
}

/**
 * The UI Kit owns device choice and joining. This status only reports signals
 * observed from the Core meeting lifecycle; it never infers that a guest is live.
 */
export function getRealtimeKitRoomStatus(
  phase: RealtimeKitRoomPhase,
  role: RealtimeKitParticipantRole,
): RealtimeKitRoomStatus {
  const roleLabel = role === "guest" ? "Guest" : role === "host" ? "Host" : "Producer";

  switch (phase) {
    case "opening":
      return {
        label: "Preparing device check",
        instructions: "Opening the RealtimeKit camera and microphone check.",
      };
    case "setup":
      return {
        label: `${roleLabel} device check open`,
        instructions: "Choose your camera and microphone in the panel, then use its Join control.",
      };
    case "joined":
      return {
        label: "Joined contributor room",
        instructions: "Your room connection is active. The producer still controls whether a source is on air.",
      };
    case "unavailable":
      return {
        label: "Room unavailable",
        instructions: "Close and reopen the device check after resolving the reported problem.",
      };
    default:
      return {
        label: "Room closed",
        instructions: "Open the device check to choose a camera and microphone before joining.",
      };
  }
}

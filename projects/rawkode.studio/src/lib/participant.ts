import type { Participant } from "livekit-client";
import type { ParticipantInfo } from "livekit-server-sdk";

export interface ParticipantMetadata {
  role?: "director" | "participant" | "viewer";
}

/**
 * Safely parse participant metadata to extract the role
 * @param participant The participant object from LiveKit
 * @returns The parsed metadata with role, or an empty object if parsing fails
 */
export function parseParticipantMetadata(
  participant:
    | Participant
    | ParticipantInfo
    | { metadata?: string }
    | undefined,
): ParticipantMetadata {
  if (!participant?.metadata) {
    return {};
  }

  try {
    const metadata = JSON.parse(participant.metadata);
    return {
      role: metadata.role as ParticipantMetadata["role"],
    };
  } catch (error) {
    console.warn("Failed to parse participant metadata:", error);
    return {};
  }
}

/**
 * Get the role of a participant from attributes
 * @param participant The participant object
 * @returns The participant's role
 */
export function getParticipantRole(
  participant:
    | Participant
    | ParticipantInfo
    | { attributes?: Record<string, string> }
    | undefined,
): "director" | "participant" | "viewer" {
  // Get role from attributes
  const role = participant?.attributes?.role;
  if (role && ["director", "participant", "viewer"].includes(role)) {
    return role as "director" | "participant" | "viewer";
  }

  // Default to viewer
  return "viewer";
}

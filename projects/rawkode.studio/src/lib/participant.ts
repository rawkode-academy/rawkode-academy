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
 * Get the role of a participant, with fallback to attributes for backwards compatibility
 * @param participant The participant object
 * @returns The participant's role
 */
export function getParticipantRole(
  participant:
    | Participant
    | ParticipantInfo
    | { metadata?: string; attributes?: Record<string, string> }
    | undefined,
): "director" | "participant" | "viewer" {
  // First try to get role from metadata
  const metadata = parseParticipantMetadata(participant);
  if (metadata.role) {
    return metadata.role;
  }

  // Fallback to attributes for backwards compatibility
  const attributeRole = participant?.attributes?.role;
  if (
    attributeRole === "director" ||
    attributeRole === "participant" ||
    attributeRole === "viewer"
  ) {
    return attributeRole;
  }

  // Default to viewer
  return "viewer";
}

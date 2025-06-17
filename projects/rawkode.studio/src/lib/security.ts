import type { OidcStandardClaims } from "oidc-client-ts";
import { tokenVerifier } from "@/lib/livekit";

export const roles = ["guest", "director", "contributor"] as const;
export type Roles = (typeof roles)[number];

export interface OidcStandardClaimsWithRoles extends OidcStandardClaims {
  roles: Roles[];
  name?: string;
}

/**
 * Checks if a user has the director role
 * @param user The user claims object
 * @returns true if the user has the director role
 */
export function hasDirectorRole(
  user: OidcStandardClaimsWithRoles | undefined,
): boolean {
  return user?.roles?.includes("director") ?? false;
}

export interface LiveKitAuth {
  token: string;
  identity: string;
  room?: string;
  displayName?: string;
}

/**
 * Extracts and verifies a LiveKit token from the Authorization header
 * @param request The incoming request
 * @returns The token and participant identity, or null if invalid/missing
 */
export async function extractLiveKitAuth(
  request: Request,
): Promise<LiveKitAuth | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = await tokenVerifier.verify(token);
    const identity = decoded.sub;
    if (!identity) {
      return null;
    }
    // Extract displayName from attributes if available
    const displayName = decoded.attributes?.displayName;
    return {
      token,
      identity,
      room: decoded.video?.room,
      displayName,
    };
  } catch (_error) {
    return null;
  }
}

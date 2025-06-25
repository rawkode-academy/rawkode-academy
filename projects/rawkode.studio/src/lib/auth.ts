import { ZITADEL_CLIENT_ID, ZITADEL_URL } from "astro:env/server";
import type { OAuth2Tokens } from "arctic";
import { createS256CodeChallenge } from "arctic/dist/oauth2";
import { createOAuth2Request, sendTokenRequest } from "arctic/dist/request";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { OidcStandardClaims } from "oidc-client-ts";
import { tokenVerifier } from "@/lib/livekit";

// ============================================
// Types and Interfaces
// ============================================

export const roles = ["guest", "director", "contributor"] as const;
export type Roles = (typeof roles)[number];

export interface OidcStandardClaimsWithRoles extends OidcStandardClaims {
  roles: Roles[];
  name?: string;
}

export interface LiveKitAuth {
  token: string;
  identity: string;
  room?: string;
  displayName?: string;
}

type ZitadelRoles = { [role: string]: { [aud: string]: string } };

// ============================================
// Role Checking Utilities
// ============================================

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

// ============================================
// LiveKit Authentication
// ============================================

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
    // Extract displayName from the name field
    const displayName = decoded.name;
    return {
      token,
      identity,
      room: decoded.video?.room,
      displayName,
    };
  } catch (error) {
    console.error("Failed to decode access token:", error);
    return null;
  }
}

// ============================================
// Zitadel OIDC Client
// ============================================

export class Zitadel {
  private readonly baseUrl = ZITADEL_URL;
  private readonly clientId = ZITADEL_CLIENT_ID;

  // JWKS endpoint for verifying JWT signatures
  private readonly jwksUrl = `${this.baseUrl}/oauth/v2/keys`;
  // Create a remote JWK set for token verification
  private readonly jwks = createRemoteJWKSet(new URL(this.jwksUrl));

  private readonly authorizationEndpoint = `${this.baseUrl}/oauth/v2/authorize`;
  private readonly redirectUri = `${import.meta.env.SITE}/api/auth/callback`;
  private readonly tokenEndpoint = `${this.baseUrl}/oauth/v2/token`;

  private readonly scopes = [
    "openid",
    "email",
    "profile",
    "urn:zitadel:iam:org:project:id:zitadel:aud",
    "urn:zitadel:iam:org:projects:roles",
  ];

  public createAuthorizationURL(state: string, codeVerifier: string): URL {
    const url = new URL(this.authorizationEndpoint);

    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", this.scopes.join(" "));

    const codeChallenge = createS256CodeChallenge(codeVerifier);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("redirect_uri", this.redirectUri);

    return url;
  }

  public async validateAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<OAuth2Tokens> {
    const searchParams = new URLSearchParams();
    searchParams.set("grant_type", "authorization_code");
    searchParams.set("code", code);
    searchParams.set("code_verifier", codeVerifier);
    searchParams.set("redirect_uri", this.redirectUri);
    searchParams.set("client_id", this.clientId);
    searchParams.set("scope", this.scopes.join(" "));

    const request = createOAuth2Request(this.tokenEndpoint, searchParams);
    const tokens = await sendTokenRequest(request);

    return tokens;
  }

  public async fetchUser(
    idToken: string | undefined,
  ): Promise<OidcStandardClaimsWithRoles | undefined> {
    if (!idToken) {
      return undefined;
    }

    try {
      // Verify the JWT signature using the JWKS
      const { payload } = await jwtVerify(idToken, this.jwks, {
        // Verify the issuer matches our Zitadel instance
        issuer: this.baseUrl,
        // Verify the audience includes our client ID
        audience: this.clientId,
      });

      // Extract roles from the verified payload
      if ("urn:zitadel:iam:org:project:roles" in payload) {
        const roles = payload[
          "urn:zitadel:iam:org:project:roles"
        ] as ZitadelRoles;

        return {
          ...payload,
          roles: Object.keys(roles).map((role) => role as Roles),
          name: payload.name as string | undefined,
        } as OidcStandardClaimsWithRoles;
      }

      return {
        ...payload,
        roles: [],
        name: payload.name as string | undefined,
      } as OidcStandardClaimsWithRoles;
    } catch (e) {
      console.error("JWT verification failed:", e);
      // Return undefined for invalid tokens instead of throwing
      return undefined;
    }
  }
}

import type { OidcStandardClaims } from "oidc-client-ts";

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

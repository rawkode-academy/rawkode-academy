import type { OidcStandardClaims } from "oidc-client-ts";

export const roles = ["guest", "director", "rofl"] as const;
export type Roles = typeof roles[number];

export interface OidcStandardClaimsWithRoles extends OidcStandardClaims {
  roles: Roles[];
}

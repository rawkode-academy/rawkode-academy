import type { OidcStandardClaimsWithRoles } from "./lib/security";

/// <reference types="astro/client" />
declare global {
  namespace App {
    interface Locals {
      user?: OidcStandardClaimsWithRoles;
    }
  }
}

import type { OidcStandardClaims } from "oidc-client-ts";

/// <reference types="astro/client" />
declare global {
  namespace App {
    interface Locals {
      user: OidcStandardClaims;
    }
  }
}

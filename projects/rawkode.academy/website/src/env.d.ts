import type { OidcStandardClaims } from "oidc-client-ts";

/// <reference types="astro/client" />
/// <reference types="../worker-configuration.d.ts" />

declare global {
	namespace App {
		interface Locals {
			user: OidcStandardClaims;
			runtime: Env;
		}
	}
}

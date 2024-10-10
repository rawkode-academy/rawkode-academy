/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />
import type { OidcStandardClaims } from "oidc-client-ts";

declare namespace App {
	interface Locals {
		user: OidcStandardClaims;
	}
}

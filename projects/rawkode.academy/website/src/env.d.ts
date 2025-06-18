import type { OidcStandardClaims } from "oidc-client-ts";

/// <reference types="astro/client" />
/// <reference types="../worker-configuration.d.ts" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare global {
	namespace App {
		interface Locals extends Runtime {
			user: OidcStandardClaims;
		}
	}
}

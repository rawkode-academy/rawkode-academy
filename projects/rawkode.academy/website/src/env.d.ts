import type { OidcStandardClaims } from "oidc-client-ts";
import type { AnalyticsEnv } from "./lib/analytics";

/// <reference types="astro/client" />
/// <reference types="../worker-configuration.d.ts" />

type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare global {
	namespace App {
		interface Locals extends Runtime {
			user: OidcStandardClaims;
			runtime: {
				env: Env & AnalyticsEnv;
			};
		}
	}
}

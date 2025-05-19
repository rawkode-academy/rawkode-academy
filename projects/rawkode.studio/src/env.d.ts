import type { OidcStandardClaimsWithRoles } from "./lib/security";

declare global {
	namespace App {
		interface Locals extends Cloudflare.Env {
			user?: OidcStandardClaimsWithRoles;
		}
	}
}

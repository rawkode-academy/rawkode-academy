import type { OidcStandardClaimsWithRoles } from "@/lib/auth/auth";

declare global {
	namespace App {
		interface Locals extends Cloudflare.Env {
			user?: OidcStandardClaimsWithRoles;
		}
	}
}

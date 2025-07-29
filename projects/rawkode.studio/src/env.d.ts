import type { OidcStandardClaimsWithRoles } from "@/lib/auth";

declare global {
	namespace App {
		interface Locals extends Cloudflare.Env {
			user?: OidcStandardClaimsWithRoles;
		}
	}
}

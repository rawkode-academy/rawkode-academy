import { object, func } from "@dagger.io/dagger";

	/**
 * Global Rawkode Academy Config
 */
@object()
export class Config {
	/**
	 * Cloudflare Account ID
	 */
	@func()
	cloudflareAccountID(): string {
		return "0aeb879de8e3cdde5fb3d413025222ce";
	}
}

import { func, object } from "@dagger.io/dagger"
import { CloudflareConfig } from "./cloudflare";

@object()
class Config {
	@func()
	cloudflare(): CloudflareConfig {
		return new CloudflareConfig();
	}
}

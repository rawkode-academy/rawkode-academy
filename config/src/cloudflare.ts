import { func, object } from "@dagger.io/dagger"

@object()
export class CloudflareConfig {
	@func()
	accountId(): string {
		return "0aeb879de8e3cdde5fb3d413025222ce";
	}
}

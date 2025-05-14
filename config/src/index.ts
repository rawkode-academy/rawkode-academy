import { func, object } from "@dagger.io/dagger";

@object()
export class Config {
	/** Cloudflare account ID. */
	@func()
	cloudflareAccountId(): string {
		return "0aeb879de8e3cdde5fb3d413025222ce";
	}

	/** Terraform backend URL. */
	@func()
	terraformBackendUrl(): string {
		return "https://terraform-state-backend.rawkode-academy.workers.dev";
	}

	/** Terraform backend bucket name. */
	@func()
	terraformBackendBucketName(): string {
		return "rawkode-cloud-tfstate";
	}
}

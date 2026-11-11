package cuenv

import (
	"github.com/rawkode-academy/rawkode-academy/infrastructure/dns/domains"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
)

infrastructure: {
	// The cuenv-state R2 bucket, which holds all cuenv state keyed by module
	// path.
	state: s3: {
		bucket:   "cuenv-state"
		region:   "auto"
		endpoint: "https://0aeb879de8e3cdde5fb3d413025222ce.r2.cloudflarestorage.com"
		// Used by plans and state commands: this key can't write.
		accessKeyId: _readOnly & {secretName: "CUENV_STATE_ACCESS_KEY_ID"}
		secretAccessKey: _readOnly & {secretName: "CUENV_STATE_SECRET_ACCESS_KEY"}
		context: apply: {
			accessKeyId: _readWrite & {secretName: "CUENV_STATE_ACCESS_KEY_ID"}
			secretAccessKey: _readWrite & {secretName: "CUENV_STATE_SECRET_ACCESS_KEY"}
		}
	}

	providers: {
		cloudflare: cloudflare_provider.#Provider
	}

	resources: {for _, zone in domains.zones {zone.resources}}

	// Plan (and comment the plan) on pull requests with the read-only
	// credentials; apply on pushes to main, once a reviewer approves the job.
	workflows: {
		plan: environment:  "infrastructure-plan"
		apply: environment: "infrastructure"
	}
}

package cuenv

import (
	"github.com/rawkode-academy/rawkode-academy/infrastructure/dns/domains"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/dnsimple/dnsimple:dnsimple_provider"
)

infrastructure: {
	// The cuenv-state R2 bucket, which holds all cuenv state keyed by module
	// path.
	state: s3: {
		bucket:   "cuenv-state"
		region:   "auto"
		endpoint: "https://0aeb879de8e3cdde5fb3d413025222ce.r2.cloudflarestorage.com"
		accessKeyId: _infrastructureSecret & {secretName: "CUENV_STATE_ACCESS_KEY_ID"}
		secretAccessKey: _infrastructureSecret & {secretName: "CUENV_STATE_SECRET_ACCESS_KEY"}
	}

	providers: {
		cloudflare: cloudflare_provider.#Provider
		dnsimple: dnsimple_provider.#Provider & {
			configuration: account: "126046"
		}
	}

	resources: {for _, zone in domains.zones {zone.resources}}

	// Pull requests comment a diff of the configuration, with no credentials.
	// Pushes to main apply in the `production` GitHub environment, which waits
	// for a reviewer; only then can the job log in to Infisical for the tokens.
	workflows: apply: environment: "production"
}

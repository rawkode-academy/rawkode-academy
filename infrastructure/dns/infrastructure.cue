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

	// No CI workflows for now: cuenv's plan workflow logs in with the same
	// credentials as the apply, which pull requests must never get. Plan and
	// apply locally until each workflow can name its own credentials.
}

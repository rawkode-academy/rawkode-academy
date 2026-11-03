package cuenv

import (
	"github.com/cuenv/cuenv/schema"
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
		accessKeyId: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cuenv-state/username"}
		secretAccessKey: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cuenv-state/password"}
	}

	providers: {
		cloudflare: cloudflare_provider.#Provider
		dnsimple: dnsimple_provider.#Provider & {
			configuration: account: "126046"
		}
	}

	resources: {for _, zone in domains.zones {zone.resources}}

	// Plan (and comment the plan) on pull requests; apply on pushes to main.
	workflows: {}
}

package cuenv

import (
	"github.com/rawkode-academy/rawkode-academy/infrastructure/dns/domains"
	"registry.terraform.io/cloudflare/cloudflare:cloudflare_provider"
	"registry.terraform.io/dnsimple/dnsimple:dnsimple_provider"
)

infrastructure: {
	// The rawkode-academy-cuenv-infrastructure D1 database.
	state: d1: {
		accountId:  "0aeb879de8e3cdde5fb3d413025222ce"
		databaseId: "ceacd475-c672-4a64-8f4c-cbd454c08135"
		token:      _cloudflareToken
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

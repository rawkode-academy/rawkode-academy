package cuenv

import "github.com/cuenv/cuenv/schema"

schema.#Project

name: "infrastructure-dns"

// Used by the Cloudflare provider and by the D1 state store.
_cloudflareToken: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/cloudflare/api-tokens/workers"}

let _infrastructure = [{allowInfrastructure: ["plan", "apply", "import", "destroy"]}]

env: {
	CLOUDFLARE_API_TOKEN: {
		value: _cloudflareToken
		policies: _infrastructure
	}
	DNSIMPLE_TOKEN: {
		value: schema.#OnePasswordRef & {ref: "op://sa.rawkode.academy/dnsimple/password"}
		policies: _infrastructure
	}
}

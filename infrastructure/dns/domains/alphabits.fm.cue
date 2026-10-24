package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "alphabits.fm": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "6323830cb7c72b449086681b08369f25"
	ttl: 300
}

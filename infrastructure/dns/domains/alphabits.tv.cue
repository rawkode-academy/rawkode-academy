package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "alphabits.tv": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "690594062e5397ef011f1171a83e1cdf"
	ttl: 300
}

package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.community": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "308cf7be0b156819e0a4441b25c5d259"
	ttl: 300
}

package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "klustered.live": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "6c26a11bedfdf91721a0075fe76a0c5c"
	ttl: 300
}

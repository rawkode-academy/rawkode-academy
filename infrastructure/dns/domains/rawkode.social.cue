package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.social": zone.#CloudflareRegistrar & {
	id:  "b583535fe9918ae6f35945fcef628589"
	ttl: 300
}

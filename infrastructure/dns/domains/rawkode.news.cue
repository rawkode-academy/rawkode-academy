package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.news": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "ae652c85de24115b87062dfcf5135231"
	ttl: 300
}

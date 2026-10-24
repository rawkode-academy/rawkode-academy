package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.studio": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "cc292db55f7219f319dfc91a07b7e3f5"
	ttl: 300
	settings: ssl: "strict"
}

package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.live": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "d1cc4609351d014225f7da761779aa61"
	ttl: 300
}

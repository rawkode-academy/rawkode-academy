package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "chappaai.dev": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "49851a38c6769beb92ab49feefb59db9"
	ttl: 300
}

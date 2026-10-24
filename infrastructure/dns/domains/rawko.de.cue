package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawko.de": zone.#DNSimpleRegistrar & zone.#NoEmail & {
	id:  "531c09abeb862407e3536bc798929ba4"
	ttl: 300
}

package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "alphabits.show": zone.#CloudflareRegistrar & zone.#NoEmail & {
	id:  "21064c17caae10e78211d329cff1f9b7"
	ttl: 300
}

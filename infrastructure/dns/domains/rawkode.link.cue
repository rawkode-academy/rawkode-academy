package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.link": zone.#DNSimpleRegistrar & zone.#NoEmail & {
	id: "479720c27500c389bcb7ee6a20f087c2"
}

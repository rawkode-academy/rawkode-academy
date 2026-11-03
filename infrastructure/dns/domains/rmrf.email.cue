package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rmrf.email": zone.#CloudflareRegistrar & zone.#Fastmail & {
	id: "e599faa73977cad390ccd6b6490007b6"
}

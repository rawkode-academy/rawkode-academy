package domains

import "github.com/rawkode-academy/rawkode-academy/infrastructure/dns/zone"

zones: "rawkode.xyz": zone.#CloudflareRegistrar & {
	id: "8b29d7b4ef4387e4dba95ab6f0dff408"
}
